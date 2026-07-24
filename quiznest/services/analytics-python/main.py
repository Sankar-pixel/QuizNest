# services/analytics-python/main.py
#
# QuizNest Analytics & Assist Service
# ------------------------------------
# A standalone FastAPI microservice that reads from the same MongoDB
# database the Node backend writes to, and exposes:
#   - Aggregated analytics (overall + per-category performance)
#   - Per-user performance breakdown
#   - Adaptive-difficulty suggestions (heuristic, based on accuracy)
#   - A lightweight, self-contained hint generator (no external AI calls —
#     purely rule-based text heuristics, so no API key is required)
#
# This service is READ-MOSTLY: it never mutates User XP/levels (that stays
# the Node backend's job), keeping a single source of truth for progression.

import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId

from question_generator import generate_questions, VALID_CATEGORIES, llm_configured

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/quiznest")
INTERNAL_ADMIN_KEY = os.getenv("INTERNAL_ADMIN_KEY", "")

app = FastAPI(title="QuizNest Analytics & Assist Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient(MONGO_URI)
db = client.get_default_database()


# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------
class HintRequest(BaseModel):
    questionText: str
    options: List[str]
    category: Optional[str] = None


class HintResponse(BaseModel):
    hint: str
    eliminatedOption: Optional[str] = None


class CategoryPerformance(BaseModel):
    category: str
    questionCount: int


class AdaptiveDifficultyResponse(BaseModel):
    userId: str
    accuracy: float
    suggestedDifficulty: str
    reasoning: str


class GenerateQuestionsRequest(BaseModel):
    category: str
    count: int = 10


class GeneratedQuestionPreview(BaseModel):
    questionText: str
    options: List[str]
    difficulty: str


def _require_internal_key(x_internal_key: str = Header(default="")):
    """Shared-secret gate so only the Node backend/admin console can trigger
    generation (and, transitively, DB writes) on this service."""
    if not INTERNAL_ADMIN_KEY:
        # No key configured: service is running in an open/dev mode. Allow it,
        # but this should always be set in any shared or production deployment.
        return
    if x_internal_key != INTERNAL_ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Key header.")


# ---------------------------------------------------------------------------
# Question generation status (which mode is active, no secrets returned)
# ---------------------------------------------------------------------------
@app.get("/generate-questions/status")
def generation_status():
    return {
        "llmConfigured": llm_configured(),
        "mode": "llm" if llm_configured() else "template",
        "validCategories": VALID_CATEGORIES,
    }


# ---------------------------------------------------------------------------
# Question generation — no manual data entry required. Uses whichever LLM
# provider is configured via env vars, or falls back to a local procedural
# generator so the question bank is never empty.
# ---------------------------------------------------------------------------
@app.post("/generate-questions")
def generate_questions_route(
    payload: GenerateQuestionsRequest, x_internal_key: str = Header(default="")
):
    _require_internal_key(x_internal_key)

    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400, detail=f"category must be one of {VALID_CATEGORIES}"
        )
    count = max(1, min(payload.count, 30))  # sane bounds — avoid runaway generation

    try:
        questions = generate_questions(payload.category, count)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}")

    if not questions:
        raise HTTPException(status_code=500, detail="No valid questions were generated.")

    result = db.questions.insert_many(questions)

    preview = [
        {"questionText": q["questionText"], "options": q["options"], "difficulty": q["difficulty"]}
        for q in questions
    ]

    return {
        "insertedCount": len(result.inserted_ids),
        "mode": "llm" if llm_configured() else "template",
        "preview": preview,
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-python"}


# ---------------------------------------------------------------------------
# Analytics: platform-wide overview
# ---------------------------------------------------------------------------
@app.get("/analytics/overview")
def analytics_overview():
    try:
        total_users = db.users.count_documents({})
        total_questions = db.questions.count_documents({})

        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "totalAnswered": {"$sum": "$stats.questionsAnswered"},
                    "totalCorrect": {"$sum": "$stats.correctAnswers"},
                    "totalXp": {"$sum": "$xp"},
                }
            }
        ]
        agg = list(db.users.aggregate(pipeline))
        totals = agg[0] if agg else {"totalAnswered": 0, "totalCorrect": 0, "totalXp": 0}

        answered = totals.get("totalAnswered", 0) or 0
        correct = totals.get("totalCorrect", 0) or 0
        accuracy = round((correct / answered) * 100, 2) if answered else 0.0

        return {
            "totalUsers": total_users,
            "totalQuestions": total_questions,
            "totalQuestionsAnswered": answered,
            "totalCorrectAnswers": correct,
            "overallAccuracyPercent": accuracy,
            "totalXpAwarded": totals.get("totalXp", 0) or 0,
        }
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Analytics: question distribution per category
# ---------------------------------------------------------------------------
@app.get("/analytics/category-performance", response_model=List[CategoryPerformance])
def category_performance():
    try:
        pipeline = [{"$group": {"_id": "$category", "questionCount": {"$sum": 1}}}]
        rows = list(db.questions.aggregate(pipeline))
        return [{"category": r["_id"], "questionCount": r["questionCount"]} for r in rows]
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Analytics: single-user performance breakdown
# ---------------------------------------------------------------------------
@app.get("/analytics/user/{user_id}")
def user_analytics(user_id: str):
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid user id.")

    user = db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    stats = user.get("stats", {})
    answered = stats.get("questionsAnswered", 0) or 0
    correct = stats.get("correctAnswers", 0) or 0
    accuracy = round((correct / answered) * 100, 2) if answered else 0.0

    return {
        "username": user.get("username"),
        "xp": user.get("xp", 0),
        "level": user.get("level", 1),
        "questionsAnswered": answered,
        "correctAnswers": correct,
        "accuracyPercent": accuracy,
        "bestStreak": stats.get("bestStreak", 0),
        "badges": user.get("badges", []),
    }


# ---------------------------------------------------------------------------
# Adaptive difficulty suggestion (pure heuristic — no ML model required,
# but structured so a trained classifier could swap in later)
# ---------------------------------------------------------------------------
def suggest_difficulty(accuracy_percent: float) -> tuple[str, str]:
    """Maps an accuracy percentage to a suggested difficulty band."""
    if accuracy_percent >= 85:
        return "hard", "Accuracy is very high — raise the challenge to keep it engaging."
    if accuracy_percent >= 60:
        return "medium", "Solid, consistent accuracy — medium difficulty keeps momentum."
    return "easy", "Accuracy is still building — easier questions help reinforce fundamentals."


@app.get("/adaptive-difficulty/{user_id}", response_model=AdaptiveDifficultyResponse)
def adaptive_difficulty(user_id: str):
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid user id.")

    user = db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    stats = user.get("stats", {})
    answered = stats.get("questionsAnswered", 0) or 0
    correct = stats.get("correctAnswers", 0) or 0
    accuracy = round((correct / answered) * 100, 2) if answered else 0.0

    difficulty, reasoning = suggest_difficulty(accuracy)

    return {
        "userId": user_id,
        "accuracy": accuracy,
        "suggestedDifficulty": difficulty,
        "reasoning": reasoning,
    }


# ---------------------------------------------------------------------------
# Hint generator — self-contained rule-based heuristics, no external calls.
# Strategy: (1) never reveal the answer, (2) eliminate one option that looks
# like a distractor when possible, (3) fall back to a generic Socratic nudge.
# ---------------------------------------------------------------------------
GENERIC_HINTS = [
    "Try eliminating the option that feels the most out of place first.",
    "Reread the question slowly — the key word is often near the start.",
    "Think about which option contradicts something you already know.",
    "If two options look similar, the answer is rarely the one that stands alone.",
]


def generate_hint(question_text: str, options: List[str]) -> HintResponse:
    # Very light heuristic: the shortest option is statistically slightly less
    # likely to be a well-constructed distractor in many quiz banks — offer
    # it as a "consider eliminating" nudge rather than a definitive answer.
    if len(options) >= 3:
        shortest = min(options, key=len)
        return HintResponse(
            hint=f"Consider whether \"{shortest}\" fits the question's phrasing at all — "
            "distractors are often longer and more specific than the shortest option.",
            eliminatedOption=shortest,
        )

    idx = abs(hash(question_text)) % len(GENERIC_HINTS)
    return HintResponse(hint=GENERIC_HINTS[idx], eliminatedOption=None)


@app.post("/hint", response_model=HintResponse)
def hint(payload: HintRequest):
    if not payload.options or len(payload.options) < 2:
        raise HTTPException(status_code=400, detail="At least 2 options are required.")
    return generate_hint(payload.questionText, payload.options)
