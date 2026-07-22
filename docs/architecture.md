# QuizNest Architecture Notes

## Why the frontend and backend are split

Three.js runs in the browser, so the 3D game must stay on the frontend. The backend exists to serve quiz content, persist user progress, and track leaderboard results. The current implementation uses ASP.NET Core so the API can be hosted as a standard web service with controllers and EF Core data access.

## Scene graph overview

```text
CityScene (THREE.Scene)
├── Lighting
├── Ground
├── Buildings[]
├── Drones[]
└── Particles
```

The quiz room view is still a natural extension of the same scene-based design. When a user selects a building, the frontend can transition into a quiz UI state and call the ASP.NET API for questions.

## API flow

```text
User opens the game
  → frontend requests questions from /quiz/{categoryId}
  → ASP.NET controller reads JSON from Data/Questions
  → user answers and submits score to /leaderboard
  → leaderboard and user totals are updated in SQLite via EF Core
```

## Backend responsibilities

| Feature | Location |
|---|---|
| Quiz endpoints | aspnet-backend/Controllers/QuizController.cs |
| User creation and lookup | aspnet-backend/Controllers/UsersController.cs |
| Score submission and leaderboard | aspnet-backend/Controllers/LeaderboardController.cs |
| EF Core context | aspnet-backend/Data/QuizNestContext.cs |
| Question JSON data | aspnet-backend/Data/Questions/ |
| Ollama-based generation | aspnet-backend/Controllers/QuestionGenerationController.cs |

## Build order

Focus on one complete loop first: city scene → click building → fetch questions from the API → answer questions → update score. That loop is more valuable than building every feature at once.
