# 🪺 QuizNest

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Three.js](https://img.shields.io/badge/Built%20with-Three.js-black?style=flat&logo=three.js)](https://threejs.org/)
[![Node.js API](https://img.shields.io/badge/Backend-Node.js-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Python Service](https://img.shields.io/badge/Analytics-Python%20%2F%20FastAPI-blue?style=flat&logo=python)](https://fastapi.tiangolo.com/)
[![Go Service](https://img.shields.io/badge/Multiplayer-Go-00ADD8?style=flat&logo=go)](https://go.dev/)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat&logo=docker)](https://docs.docker.com/compose/)

QuizNest is a futuristic, full-stack 3D interactive quiz application set within a cyberpunk floating city. Players explore an immersive, neon-drenched metropolis built in WebGL, where each towering skyscraper represents a quiz category and a torus-knot **Arcade Spire** hides two bonus puzzle games. Progression, achievements, real-time battles, and anti-cheat validation are handled by a small **polyglot backend** — Node.js, Python, and Go each doing the job they're best at — sitting behind a single MongoDB source of truth.

## 🚀 Features

*   **Zero Manual Question Entry:** The question bank fills itself. Whenever a category's pool runs low, the backend automatically asks the Python service to generate more — via a real LLM (OpenAI or Anthropic, pick either) if you've configured an API key, or via a built-in offline template generator if you haven't. Either way, nobody ever has to hand-type a question into the database.
*   **Interactive 3D Hub World:** A cyberpunk city with floating particle rain, a gradient nebula sky dome, sweeping neon searchlights, drifting patrol drones, and six glowing category towers — all in WebGL (Three.js).
*   **Arcade Spire & Mini-Games:** A visually "crazy" torus-knot structure in the city center leads to two bonus puzzles — **Neon Circuit Match** (memory matching) and **Cipher Break** (Caesar-cipher word decoding).
*   **Secure Full-Stack Architecture:** Server-side answer validation prevents client-side manipulation. Accounts, XP, badges, and leaderboards are written directly to MongoDB.
*   **Achievements & Badges:** A rule-based achievement engine (`first_blood`, `streak_10`, `centurion`, etc.) awards badges live during quiz play, with animated toast notifications.
*   **Real-Time Multiplayer Battles:** A dedicated Go WebSocket service lets two or more players share a "battle room" and see each other's live score updates as they answer — while the Node backend remains the sole authority on correctness.
*   **Analytics & Adaptive Difficulty (Python):** A FastAPI microservice exposes platform-wide analytics, per-user performance breakdowns, a heuristic adaptive-difficulty suggestion, and a self-contained hint generator (no external AI API calls required).
*   **Admin Console:** A standalone `admin.html` panel for full CRUD on the question bank and for granting/revoking admin rights, gated by an `isAdmin` JWT-protected route.
*   **Cinematic Camera Transitions:** GSAP-driven camera interpolation moves seamlessly between the bird's-eye city view and holographic quiz rooms.
*   **Immersive Visual Feedback:** UnrealBloom post-processing, particle-burst correct-answer effects, and a custom chromatic-aberration glitch shader with camera shake for wrong answers.
*   **Procedural Audio Engine:** 100% synthesized UI lasers, digital glitches, and an evolving ambient drone via the Web Audio API — zero external audio files.
*   **Automated Tests:** Jest + Supertest for the Node API, Pytest for the Python service, and native `go test` coverage for the multiplayer room logic.
*   **One-Command Deployment:** A single `docker-compose up` brings up all five services (Mongo, Node, Python, Go, and the static frontend).

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **3D Frontend** | Three.js (WebGL), EffectComposer (UnrealBloomPass + custom glitch ShaderPass), GSAP, Tailwind CSS (glassmorphic HUD) |
| **Core API** | Node.js, Express.js, JWT, bcrypt, Mongoose |
| **Analytics / AI-Assist** | Python 3.12, FastAPI, PyMongo |
| **Multiplayer** | Go 1.22, `gorilla/websocket` |
| **Database** | MongoDB |
| **Deployment** | Docker, Docker Compose, Nginx (static frontend) |
| **Testing** | Jest + Supertest (Node), Pytest (Python), `go test` (Go) |

## 📦 Repository Structure

```text
quiznest/
├── docker-compose.yml         # Brings up all 5 services together
├── backend/                   # Node.js — core API, auth, anti-cheat, admin
│   ├── models/
│   │   └── Schemas.js         # User, Question, Achievement Mongoose models
│   ├── middleware/
│   │   └── admin.js           # requireAdmin gate for admin-only routes
│   ├── tests/
│   │   └── quiz.test.js       # Jest + Supertest suite
│   ├── server.js              # Express app: auth, quiz, achievements, admin, leaderboard
│   ├── seed.js                # Populates sample questions
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── services/
│   ├── analytics-python/       # Python — analytics, hints, adaptive difficulty
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── tests/
│   │       └── test_main.py
│   └── multiplayer-go/         # Go — real-time WebSocket battle relay
│       ├── main.go
│       ├── main_test.go
│       ├── go.mod
│       └── Dockerfile
├── frontend/
│   ├── index.html              # Main 3D city + Glassmorphic HUD
│   ├── admin.html               # Admin console (question + user management)
│   ├── nginx.conf
│   ├── Dockerfile
│   └── src/
│       ├── main.js             # State, GSAP camera, API/WS wiring
│       ├── engine/
│       │   ├── Scene.js        # WebGL scene, towers, arcade spire, bloom pipeline
│       │   └── Audio.js        # Procedural Web Audio sound engine
│       ├── ui/
│       │   ├── QuizUI.js       # Question/answer card rendering
│       │   └── AdminUI.js      # Admin console logic
│       └── games/
│           ├── PuzzleGrid.js   # Neon Circuit Match (memory puzzle)
│           └── CipherBreak.js  # Cipher Break (Caesar-cipher puzzle)
└── README.md
```

## 🤖 Automatic Question Generation (no manual data entry)

You never need to type questions into the database yourself. Whenever `GET /api/questions/:category` sees fewer than 10 questions for a category, the Node backend automatically calls the Python service's `/generate-questions` endpoint before serving the quiz. That endpoint works in one of two modes, chosen automatically:

| Mode | When it's used | How it works |
|---|---|---|
| **LLM mode** | `LLM_PROVIDER` + a matching API key are set on the analytics service | Calls OpenAI's or Anthropic's chat API (your choice — any model string works) with a strict "return only JSON" prompt, validates the shape (4 options, valid correct index), and discards anything malformed |
| **Template mode** (default) | No `LLM_PROVIDER`/API key configured | A local, offline, procedural generator builds varied questions from a small fact bank per category — zero config, zero external calls, zero cost |

To use a real model, set these on the `analytics` service (see `services/analytics-python/.env.example`):

```bash
LLM_PROVIDER=openai            # or "anthropic"
OPENAI_API_KEY=sk-...          # if using openai
OPENAI_MODEL=gpt-4o-mini       # or any other model you have access to
```

You can also trigger generation manually from the Admin Console's **✨ Generate with AI** button, or hit the service directly:

```bash
curl -X POST http://localhost:8000/generate-questions \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: $INTERNAL_ADMIN_KEY" \
  -d '{"category": "science", "count": 10}'
```

`seed.js` still exists for convenience, but it's now optional — the game is fully playable with an empty database on first boot.

## 🧪 What's Been Verified vs. What Needs a Real Run

This project was built and debugged in a sandboxed environment **with no network access and no MongoDB/Go/FastAPI available to install**, so here's an honest breakdown of what got real execution vs. what only got careful line-by-line review.

**Actually executed and verified — including a real integration test of `server.js` itself:**
- Every `.js` file (syntax-checked with `node --check`) and every `.py` file (compiled with `py_compile`)
- The XP/leveling curve and achievement-award logic — extracted and run directly with real assertions
- The frontend's XP progress-bar math cross-checked against the backend's leveling curve across 1,350+ sampled XP values — consistent
- The **template question generator** — executed across all 6 categories, 20+ randomized trials each. Caught and fixed a real bug: two geography facts shared the same answer ("the Nile"), which could produce duplicate options in a single question. Fixed both the data and the generator (de-duplicates distractors, plus a final uniqueness safety net)
- The LLM-mode fallback path — a real network call was attempted and failed as expected in this sandbox, correctly falling back to template mode instead of crashing
- **`server.js`'s actual route handlers, run for real** — not just read. Since `express`/`mongoose`/`bcryptjs`/`jsonwebtoken` can't be installed offline here, minimal in-memory shims were built implementing just enough of their real APIs (route registration, middleware chaining, chainable Mongoose queries, hash/JWT round-tripping) to execute the genuine, unmodified `server.js` code against 29 real assertions:
  - register / duplicate-username rejection / login / wrong-password rejection
  - unauthenticated requests correctly rejected with 401
  - **auto question generation actually triggers** when a category is empty, and does **not** re-trigger once the pool is full
  - **anti-cheat confirmed**: `correctOptionIndex` is genuinely absent from the question payload sent to the client
  - correct-answer submission awards XP and the `first_blood` badge; incorrect submission awards zero XP
  - leaderboard includes the test user
  - non-admin users get 403 on admin routes; a promoted admin gets 200
  - admin question create/update/delete round-trip correctly
  - the admin "Generate with AI" proxy route actually calls the generation service
  - This exercise caught and fixed **two bugs in the test harness itself** (not in `server.js`) — worth mentioning for transparency, since it shows the harness was actually exercising real async control flow rather than trivially passing.
  - `server.js` was diffed byte-for-byte against the shipped copy afterward to confirm the harness never modified it.

**Reviewed line-by-line but not executed (no Go toolchain or FastAPI available in this sandbox):**
- The Go WebSocket multiplayer relay (`main.go`) — traced the locking around `Room.broadcast`/`addClient`/`removeClient`/`markReady` for race conditions; it looks correct, but please run `go vet` and `go test ./...` yourself before relying on it in production
- The FastAPI service's actual HTTP layer (routes, dependency injection, CORS) — `fastapi`/`pymongo` aren't installable in this sandbox, so only the pure Python logic underneath (`question_generator.py`) got real execution; the route wiring in `main.py` was reviewed but not run

**Please run before deploying:**
```bash
cd backend && npm install && npm test
cd services/analytics-python && pip install -r requirements.txt pytest httpx && pytest
cd services/multiplayer-go && go mod tidy && go vet ./... && go test ./...
docker-compose up --build   # then manually click through a quiz + open two browser tabs for battle mode
```

## ⚙️ Getting Started

### Option A — Docker Compose (recommended, starts everything)

```bash
git clone <your-fork-url> quiznest && cd quiznest
JWT_SECRET=$(openssl rand -hex 32) docker-compose up --build
```

This starts:

| Service | URL |
|---|---|
| Frontend | http://localhost:8081 |
| Backend API | http://localhost:4000/api |
| Analytics API | http://localhost:8000 |
| Multiplayer WS | ws://localhost:8080/ws/battle |
| MongoDB | localhost:27017 |

Seed sample questions once containers are up (optional — the app auto-generates questions on first use of any category if the bank is empty):

```bash
docker exec -it quiznest-backend node seed.js
```

### Option B — Run each service manually

**Backend (Node):**
```bash
cd backend
npm install
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm run seed            # optional: sample questions
npm run dev              # http://localhost:4000
```

**Analytics service (Python):**
```bash
cd services/analytics-python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
MONGO_URI=mongodb://127.0.0.1:27017/quiznest uvicorn main:app --reload --port 8000
```

**Multiplayer service (Go):**
```bash
cd services/multiplayer-go
go mod tidy
go run main.go   # ws://localhost:8080/ws/battle
```

**Frontend:**
```bash
cd frontend
npx serve .   # or: python3 -m http.server 5173
```

Then open the served URL, register/sign in from the bottom-right panel, and click a glowing tower — or the spiraling Arcade Spire — to begin.

### Making yourself an admin

The first account has to be promoted manually (there's no bootstrap UI, by design — admin escalation shouldn't be self-service):

```bash
docker exec -it quiznest-mongo mongosh quiznest --eval \
  'db.users.updateOne({username: "yourUsername"}, {$set: {isAdmin: true}})'
```

Then open `admin.html` and sign in with that account.

## 🧪 Running Tests

```bash
# Node
cd backend && npm test

# Python
cd services/analytics-python && pip install pytest httpx && pytest

# Go
cd services/multiplayer-go && go test ./...
```

## 🧠 How Anti-Cheat Works

The client never receives `correctOptionIndex`. Every answer is posted to `POST /api/quiz/submit` with the question ID, and the Node backend alone determines correctness, XP, and achievement unlocks. The Python and Go services are strictly read-only with respect to game truth — analytics reads aggregate stats, and the multiplayer relay only rebroadcasts scores that Node has already verified — so no service outside `backend/` can forge a result.

## 📡 API Reference

### Core API (Node — `:4000/api`)

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create an account, returns a JWT |
| `POST` | `/auth/login` | — | Authenticate, returns a JWT |
| `GET` | `/questions/:category` | JWT | Fetch 10 random questions (no answers included) |
| `POST` | `/quiz/submit` | JWT | Submit an answer for server-side verification, returns XP/badges |
| `GET` | `/achievements` | — | Public catalog of all achievement metadata |
| `GET` | `/leaderboard` | — | Top 10 users ranked by XP |
| `GET/POST/PUT/DELETE` | `/admin/questions` | JWT + admin | Manage the question bank |
| `GET` | `/admin/users` | JWT + admin | List all users |
| `PUT` | `/admin/users/:id/admin` | JWT + admin | Grant or revoke admin rights |

### Analytics service (Python — `:8000`)

| Method | Route | Description |
|---|---|---|
| `GET` | `/analytics/overview` | Platform-wide totals + overall accuracy |
| `GET` | `/analytics/category-performance` | Question count per category |
| `GET` | `/analytics/user/{user_id}` | Per-user accuracy, streaks, badges |
| `GET` | `/adaptive-difficulty/{user_id}` | Heuristic difficulty suggestion (easy/medium/hard) |
| `POST` | `/hint` | Rule-based hint for a given question + options |
| `GET` | `/generate-questions/status` | Reports whether LLM or template mode is active |
| `POST` | `/generate-questions` | Generates + inserts N questions for a category (requires `X-Internal-Key` if `INTERNAL_ADMIN_KEY` is set) |

### Multiplayer service (Go — `:8080`)

| Route | Protocol | Description |
|---|---|---|
| `/ws/battle?room=<id>&username=<name>` | WebSocket | Join a live battle room; broadcasts join/leave/score/round events |
| `/health` | HTTP GET | Health check |

## 🗺️ Roadmap Ideas

*   Persist multiplayer battle results back into the Node backend for a dedicated "Battle Leaderboard."
*   Swap the Python heuristic hint generator for an actual LLM call, gated behind a server-side API key.
*   Add a third mini-game (e.g., a reaction-time "signal intercept" game) to the Arcade Spire.
*   Replace the in-memory Go room state with Redis pub/sub for horizontal scaling across multiple multiplayer instances.

## 📄 License

MIT
