import json
import random
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent / "data" / "questions"


@router.get("/{category_id}")
def get_questions(category_id: str, limit: int = 0):
    file_path = DATA_DIR / f"{category_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"No questions found for '{category_id}'")

    with open(file_path, "r") as f:
        questions = json.load(f)

    if limit and limit > 0:
        questions = random.sample(questions, min(limit, len(questions)))

    return questions


@router.get("/")
def list_categories():
    return [f.stem for f in DATA_DIR.glob("*.json")]
