// services/multiplayer-go/main_test.go
package main

import "testing"

func TestGetOrCreateRoomReturnsSameInstance(t *testing.T) {
	hub := newHub()
	roomA := hub.getOrCreateRoom("arena-1")
	roomB := hub.getOrCreateRoom("arena-1")

	if roomA != roomB {
		t.Fatal("expected getOrCreateRoom to return the same Room instance for the same id")
	}
}

func TestGetOrCreateRoomDifferentIds(t *testing.T) {
	hub := newHub()
	roomA := hub.getOrCreateRoom("arena-1")
	roomB := hub.getOrCreateRoom("arena-2")

	if roomA == roomB {
		t.Fatal("expected different room ids to produce different Room instances")
	}
}

func TestMarkReadyTriggersOnlyWhenAllClientsReady(t *testing.T) {
	room := &Room{
		id:      "test-room",
		clients: make(map[*Client]bool),
		ready:   make(map[*Client]bool),
	}

	c1 := &Client{username: "alice", send: make(chan []byte, 4), room: room}
	c2 := &Client{username: "bob", send: make(chan []byte, 4), room: room}
	room.clients[c1] = true
	room.clients[c2] = true

	room.markReady(c1)
	if len(room.ready) != 1 {
		t.Fatalf("expected 1 ready client, got %d", len(room.ready))
	}

	room.markReady(c2)
	if len(room.ready) != 0 {
		t.Fatalf("expected ready map to reset to 0 after all clients ready, got %d", len(room.ready))
	}
}
