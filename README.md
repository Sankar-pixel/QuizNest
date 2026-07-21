# 🪺 QuizNest

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Three.js](https://img.shields.io/badge/Built%20with-Three.js-black?style=flat&logo=three.js)](https://threejs.org/)
[![Node.js API](https://img.shields.io/badge/Backend-Node.js-green?style=flat&logo=node.js)](https://nodejs.org/)

QuizNest is a futuristic, full-stack 3D interactive quiz application set within a cyberpunk floating city. Players explore an immersive, neon-drenched metropolis built in WebGL, where each towering skyscraper represents a quiz category. Progression, high scores, and anti-cheat validation are safely handled by a decoupled backend API and database layer.

## 🚀 Features

*   **Interactive 3D Hub World:** A fully realized cyberpunk city with floating particle rain, dynamic weather, moving drones, and glowing category towers built entirely in WebGL (Three.js).
*   **Secure Full-Stack Architecture:** Server-side answer validation prevents client-side manipulation. User accounts, XP growth, and leaderboards are written directly to a database.
*   **Cinematic Camera Transitions:** Uses advanced camera panning and position interpolation (via GSAP) to transition seamlessly from a birds-eye city view directly into holographic quiz rooms.
*   **Immersive Visual Feedback:** Dynamic post-processing bloom effects make neon lighting pop. Correct answers trigger particle explosions; incorrect answers invoke sharp shader glitches and screen-shake effects.
*   **Procedural Audio Engine:** Utilizes the HTML5 Web Audio API to generate synthetic UI lasers, atmospheric hums, and error alerts on-the-fly without requiring heavy external asset files.

## 🛠️ Tech Stack

*   **Frontend client:** Three.js (WebGL Core), EffectComposer (UnrealBloomPass), GSAP Animations, Tailwind CSS (Glassmorphic HUD)
*   **Backend API:** Node.js, Express.js, JSON Web Tokens (JWT)
*   **Database Layer:** MongoDB / Mongoose ODM

## 📦 Repository Structure

```text
quiznest/
├── backend/
│   ├── models/
│   │   └── Schemas.js     # User, Question, and Leaderboard DB structures
│   ├── server.js          # Express app, JWT auth, and verification endpoints
│   └── .env.example       # Database URI and token secret templates
├── frontend/
│   ├── index.html         # Main HTML page & Glassmorphic HUD template
│   ├── src/
│   │   ├── main.js        # Global state coordinator & API fetching layer
│   │   ├── engine/
│   │   │   ├── Scene.js   # WebGL Scene, custom mesh towers, bloom pipeline
│   │   │   └── Audio.js   # Synth sound generations via AudioContext
│   │   └── ui/
│   │       └── QuizUI.js  # Dynamic quiz rendering & option processing
└── README.md              # Project documentation
```

## ⚙️ Getting Started

### Prerequisites

*   Node.js 18+
*   A running MongoDB instance (local or [Atlas](https://www.mongodb.com/atlas))

### Backend setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run dev             # starts the API on http://localhost:4000
```

### Frontend setup

The frontend is dependency-free vanilla JS loaded via CDN import maps (Three.js, GSAP) and the Tailwind CDN build, so it can be served with any static file server:

```bash
cd frontend
npx serve .              # or: python3 -m http.server 5173
```

Then open the served URL in your browser. Sign in or register from the panel in the bottom-right corner, then click a glowing tower to enter its quiz room.

## 🧠 How Anti-Cheat Works

The client never receives `correctOptionIndex`. Every answer is sent to `POST /api/quiz/submit` along with the question ID, and the server alone determines correctness, computes XP, and updates the user record. This means a modified or inspected frontend cannot forge a correct result.

## 📡 API Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account, returns a JWT |
| `POST` | `/api/auth/login` | Authenticate, returns a JWT |
| `GET` | `/api/questions/:category` | Fetch 10 random questions (no answers included) |
| `POST` | `/api/quiz/submit` | Submit an answer for server-side verification |
| `GET` | `/api/leaderboard` | Top 10 users ranked by XP |

## 📄 License

MIT
