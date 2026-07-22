from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User

router = APIRouter()


class UserCreate(BaseModel):
    username: str


class UserOut(BaseModel):
    id: int
    username: str
    level: int
    xp: int
    avatar_config: str
    created_at: str

    class Config:
        orm_mode = True


@router.post("/", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(username=payload.username)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{username}", response_model=UserOut)
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
