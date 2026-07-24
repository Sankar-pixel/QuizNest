# services/analytics-python/tests/test_main.py
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, generate_hint, suggest_difficulty

client = TestClient(app)


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_generate_hint_returns_non_empty_string():
    result = generate_hint("What is 2 + 2?", ["3", "4", "5", "22"])
    assert isinstance(result.hint, str)
    assert len(result.hint) > 0


def test_generate_hint_never_reveals_full_answer_field():
    # The hint object must never contain a `correctOptionIndex`-like field.
    result = generate_hint("Sample question?", ["A", "B", "C"])
    assert not hasattr(result, "correctOptionIndex")


def test_suggest_difficulty_bands():
    assert suggest_difficulty(90)[0] == "hard"
    assert suggest_difficulty(70)[0] == "medium"
    assert suggest_difficulty(30)[0] == "easy"


def test_hint_endpoint_rejects_single_option():
    res = client.post("/hint", json={"questionText": "Q?", "options": ["only one"]})
    assert res.status_code == 400


def test_hint_endpoint_accepts_valid_payload():
    res = client.post(
        "/hint",
        json={"questionText": "Which planet is red?", "options": ["Earth", "Mars", "Venus", "Jupiter"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert "hint" in body
