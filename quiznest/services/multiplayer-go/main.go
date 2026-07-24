// services/multiplayer-go/main.go
//
// QuizNest Multiplayer Battle Service
// ------------------------------------
// A lightweight, dependency-minimal WebSocket server that lets players
// battle head-to-head in real time. Answer CORRECTNESS is still verified
// exclusively by the Node backend's `/api/quiz/submit` (anti-cheat stays
// centralized) — this service only relays presence, live score updates,
// and round-sync events between players in the same room, so opponents
// see each other's progress instantly.
//
// Message protocol (JSON over WebSocket), client -> server:
//   {"type": "join",  "username": "neonRunner"}
//   {"type": "score_update", "score": 340, "correct": true}
//   {"type": "next_round_ready"}
//
// Server -> clients (broadcast to the room):
//   {"type": "player_joined", "username": "...", "playerCount": 2}
//   {"type": "player_left",   "username": "...", "playerCount": 1}
//   {"type": "score_update",  "username": "...", "score": 340, "correct": true}
//   {"type": "round_advance"} // sent once all connected players are ready

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // dev-friendly; restrict in production
}

// ---------------------------------------------------------------------------
// Client + Room bookkeeping
// ---------------------------------------------------------------------------

type Client struct {
	conn     *websocket.Conn
	send     chan []byte
	username string
	room     *Room
	mu       sync.Mutex
}

type Room struct {
	id      string
	clients map[*Client]bool
	ready   map[*Client]bool
	mu      sync.Mutex
}

type Hub struct {
	rooms map[string]*Room
	mu    sync.Mutex
}

func newHub() *Hub {
	return &Hub{rooms: make(map[string]*Room)}
}

func (h *Hub) getOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, exists := h.rooms[roomID]
	if !exists {
		room = &Room{
			id:      roomID,
			clients: make(map[*Client]bool),
			ready:   make(map[*Client]bool),
		}
		h.rooms[roomID] = room
	}
	return room
}

func (r *Room) broadcast(payload map[string]interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Println("marshal error:", err)
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	for c := range r.clients {
		select {
		case c.send <- data:
		default:
			// client's send buffer is full/dead — drop it
			close(c.send)
			delete(r.clients, c)
		}
	}
}

func (r *Room) addClient(c *Client) {
	r.mu.Lock()
	r.clients[c] = true
	count := len(r.clients)
	r.mu.Unlock()

	r.broadcast(map[string]interface{}{
		"type":        "player_joined",
		"username":    c.username,
		"playerCount": count,
	})
}

func (r *Room) removeClient(c *Client) {
	r.mu.Lock()
	delete(r.clients, c)
	delete(r.ready, c)
	count := len(r.clients)
	r.mu.Unlock()

	r.broadcast(map[string]interface{}{
		"type":        "player_left",
		"username":    c.username,
		"playerCount": count,
	})
}

func (r *Room) markReady(c *Client) {
	r.mu.Lock()
	r.ready[c] = true
	allReady := len(r.ready) == len(r.clients) && len(r.clients) > 0
	if allReady {
		r.ready = make(map[*Client]bool) // reset for next round
	}
	r.mu.Unlock()

	if allReady {
		r.broadcast(map[string]interface{}{"type": "round_advance"})
	}
}

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

func serveWs(hub *Hub, w http.ResponseWriter, req *http.Request) {
	roomID := req.URL.Query().Get("room")
	username := req.URL.Query().Get("username")
	if roomID == "" || username == "" {
		http.Error(w, "room and username query params are required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	room := hub.getOrCreateRoom(roomID)
	client := &Client{
		conn:     conn,
		send:     make(chan []byte, 32),
		username: username,
		room:     room,
	}

	room.addClient(client)

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.room.removeClient(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg["type"] {
		case "score_update":
			c.room.broadcast(map[string]interface{}{
				"type":     "score_update",
				"username": c.username,
				"score":    msg["score"],
				"correct":  msg["correct"],
			})
		case "next_round_ready":
			c.room.markReady(c)
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

func main() {
	hub := newHub()

	http.HandleFunc("/ws/battle", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"multiplayer-go"}`))
	})

	log.Println("[multiplayer-go] listening on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
