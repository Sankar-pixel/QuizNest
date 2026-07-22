# 🌆 QuizNest — A Futuristic 3D Quiz Universe

QuizNest turns quiz-taking into exploration. You land in a neon cyberpunk city
floating above the clouds — every glowing skyscraper is a quiz category.
Walk (fly) up to a building, watch the camera glide inside, and answer
questions on holographic floating panels while drones buzz overhead and
particles drift through bloom-lit fog.

![status](https://img.shields.io/badge/status-in--development-blueviolet)
![license](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Core Features

| Category | Features |
|---|---|
| **World** | Floating cyberpunk city, 6 category buildings, animated drones, dynamic weather/fog, day-night cycle |
| **Camera** | Smooth cinematic zoom from city → building → quiz room (GSAP-driven) |
| **Quiz Room** | Transparent holographic panels, animated answer cards, timer ring, boss-battle mode |
| **Feedback** | Correct → energy burst + particle fireworks + glowing path; Wrong → screen glitch + chromatic aberration pulse |
| **Progression** | XP bar, levels, unlockable avatar skins, achievement badges, daily missions, boss challenges |
| **Social** | Global + friends leaderboard (backend-driven) |
| **Audio** | Ambient synthwave loop, UI clicks, correct/incorrect stingers (Howler.js) |
| **Rendering** | Three.js + UnrealBloomPass + PMREM lighting + postprocessing pipeline |

---

## 🧱 Tech Stack

- **Frontend (the 3D game):** Three.js, Vite, GSAP (camera/UI tweening), Howler.js (audio), plain JS modules (or swap to TypeScript later)
- **Backend (data + accounts):** Python 3.11+, FastAPI, SQLite (via SQLAlchemy) — swap to Postgres later
- **Data:** JSON question banks per category
- **Deployment:** Frontend → Vercel/Netlify (static build). Backend → Render/Fly.io/Railway

Why this split: Three.js **must** run in the browser (WebGL), so it can't be
"done in Python." Python's job is everything server-side — serving quiz
questions, storing XP/leaderboards, auth — talked to over a REST API.

---

## 📁 Project Structure

```
quiznest/
├── frontend/                  # The 3D game (Three.js)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/assets/
│   │   ├── models/            # .glb buildings, avatar, drones
│   │   ├── textures/          # neon signage, HDRI skyboxes
│   │   ├── sounds/            # sfx + ambient music
│   │   └── fonts/
│   └── src/
│       ├── main.js            # entry point, renderer, render loop
│       ├── scenes/
│       │   ├── CityScene.js       # the floating city hub
│       │   └── QuizRoomScene.js   # holographic quiz interior
│       ├── entities/
│       │   ├── Building.js        # category building (glow, hover, click)
│       │   ├── Avatar.js          # customizable player avatar
│       │   └── Drone.js           # ambient flying drones
│       ├── systems/
│       │   ├── PostProcessing.js  # bloom, glitch, chromatic aberration
│       │   ├── ParticleSystem.js  # fireworks, floating dust, energy bursts
│       │   ├── WeatherSystem.js   # rain/fog/day-night
│       │   └── AudioManager.js    # Howler wrapper
│       ├── ui/
│       │   ├── HUD.js             # XP bar, level, mission tracker (DOM overlay)
│       │   └── QuizPanel.js       # question/answer cards (DOM + CSS3D)
│       ├── game/
│       │   ├── XPSystem.js
│       │   ├── Achievements.js
│       │   ├── DailyMissions.js
│       │   ├── BossChallenge.js
│       │   └── GameState.js       # single source of truth, pub/sub
│       ├── utils/
│       │   └── CameraController.js # cinematic GSAP camera transitions
│       └── api/
│           └── client.js          # fetch wrapper → talks to Python backend
│
├── backend/                   # Python API (FastAPI)
│   ├── main.py
│   ├── requirements.txt
│   ├── database.py
│   ├── models.py
│   ├── routes/
│   │   ├── quiz.py            # GET questions by category
│   │   ├── users.py           # avatar, XP, achievements
│   │   └── leaderboard.py
│   └── data/questions/
│       ├── programming.json
│       ├── science.json
│       ├── mathematics.json
│       ├── history.json
│       ├── geography.json
│       └── entertainment.json
│
├── docs/
│   └── architecture.md
├── .gitignore
└── README.md
```

---

## 🗺️ Build Roadmap (suggested order)

1. **Skeleton (Week 1):** Vite + Three.js scene rendering a floor, sky, and one glowing box. Get bloom postprocessing working.
2. **City (Week 1–2):** Place 6 buildings with emissive neon materials, add drones + particle dust, orbit camera controls.
3. **Camera transitions (Week 2):** Click building → GSAP camera fly-in → fade to QuizRoomScene.
4. **Quiz UI (Week 2–3):** CSS3D or DOM-overlay panels, wire up questions from `backend`, right/wrong feedback effects.
5. **Progression (Week 3):** XP system, level-up animation, achievement popups, localStorage → then real backend persistence.
6. **Backend (parallel):** FastAPI serving questions + leaderboard + user XP, SQLite storage.
7. **Polish (Week 4+):** Avatar customization, boss challenges, daily missions, sound design, weather system, mobile responsiveness.

Start small — get one building, one click, one question loop working end to
end before scaling to 6 categories and all the game systems.

---

## 🚀 Running Locally

```bash
# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

---

## 📜 License
MIT — do whatever you want, just keep the license file.
