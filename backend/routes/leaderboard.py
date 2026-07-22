from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import LeaderboardEntry, User

router = APIRouter()


def calculate_level(total_xp: int) -> int:
    return 1 + total_xp // 100


class ScoreSubmission(BaseModel):
    username: str
    categoryId: str
    xpEarned: int


@router.post("/")
def submit_score(payload: ScoreSubmission, db: Session = Depends(get_db)):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username)
        db.add(user)
        db.commit()
        db.refresh(user)

    user.xp += payload.xpEarned
    user.level = calculate_level(user.xp)
    db.add(user)

    entry = LeaderboardEntry(
        username=username,
        category_id=payload.categoryId,
        xp_earned=payload.xpEarned,
    )
    db.add(entry)
    db.commit()
    db.refresh(user)

    return {
        "status": "recorded",
        "username": username,
        "userXp": user.xp,
        "level": user.level,
    }


@router.get("/top")
def get_top_players(limit: int = 10, db: Session = Depends(get_db)):
    results = (
        db.query(
            LeaderboardEntry.username,
            func.sum(LeaderboardEntry.xp_earned).label("total_xp"),
        )
        .group_by(LeaderboardEntry.username)
        .order_by(func.sum(LeaderboardEntry.xp_earned).desc())
        .limit(limit)
        .all()
    )
    return [{"username": r.username, "totalXp": r.total_xp} for r in results]


@router.get("/search")
def search_players(username: str, limit: int = 10, db: Session = Depends(get_db)):
    query_value = username.strip().lower()
    if not query_value:
        return []

    results = (
        db.query(
            LeaderboardEntry.username,
            func.sum(LeaderboardEntry.xp_earned).label("total_xp"),
        )
        .filter(func.lower(LeaderboardEntry.username).like(f"%{query_value}%"))
        .group_by(LeaderboardEntry.username)
        .order_by(func.sum(LeaderboardEntry.xp_earned).desc())
        .limit(limit)
        .all()
    )
    return [{"username": r.username, "totalXp": r.total_xp} for r in results]
