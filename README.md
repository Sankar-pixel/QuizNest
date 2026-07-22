# QuizNest — A Futuristic 3D Quiz Universe

QuizNest turns quiz-taking into exploration. You land in a neon cyberpunk city floating above the clouds, where each glowing skyscraper is a quiz category. The frontend delivers the 3D experience while the backend serves questions, user profiles, and leaderboard data.

![status](https://img.shields.io/badge/status-in--development-blueviolet)
![license](https://img.shields.io/badge/license-MIT-green)

## Tech stack

- Frontend: Three.js, Vite, GSAP, Howler.js
- Backend: ASP.NET Core 10, EF Core, SQLite
- Data: JSON question banks under the ASP.NET backend project

## Project structure

```text
quiznest/
├── frontend/                  # Three.js game client
│   ├── src/
│   │   ├── api/client.js
│   │   ├── scenes/
│   │   ├── entities/
│   │   ├── systems/
│   │   ├── ui/
│   │   └── game/
│   └── package.json
├── aspnet-backend/            # ASP.NET Core API
│   ├── Controllers/
│   ├── Data/
│   ├── Models/
│   ├── Services/
│   └── Data/Questions/
├── docs/architecture.md
├── .gitignore
└── README.md
```

## Backend API overview

The ASP.NET backend exposes these routes:

- GET /quiz/{categoryId}?limit=N
- GET /quiz
- POST /users
- GET /users/{username}
- POST /leaderboard
- GET /leaderboard/top
- GET /leaderboard/search

## Running locally

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd ../aspnet-backend
dotnet restore
dotnet run
```

The frontend expects the API at http://localhost:5184 by default, matching the ASP.NET launch profile.

## Notes

The repository now follows the ASP.NET backend structure instead of the earlier Python/FastAPI scaffold. The main API logic lives in the aspnet-backend folder and is wired to the frontend through the client module.
