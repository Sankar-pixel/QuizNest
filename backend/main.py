"""
QuizNest backend — serves quiz questions, tracks leaderboard scores, and
(eventually) user accounts/XP. Kept intentionally simple: JSON question
banks on disk + SQLite for anything that needs to persist across sessions.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import quiz, leaderboard, users
from database import init_db

app = FastAPI(title="QuizNest API", version="0.1.0")

# Allow the Vite dev server (and your deployed frontend) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your real frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(leaderboard.router, prefix="/leaderboard", tags=["leaderboard"])
app.include_router(users.router, prefix="/users", tags=["users"])


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def health_check():
    return {"status": "ok", "message": "QuizNest API is running"}
