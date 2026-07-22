from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    avatar_config = Column(String, default="{}")  # JSON string of avatar customization
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LeaderboardEntry(Base):
    __tablename__ = "leaderboard_entries"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True, nullable=False)
    category_id = Column(String, index=True, nullable=False)
    xp_earned = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
