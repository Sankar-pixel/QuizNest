# services/analytics-python/tests/test_question_generator.py
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import question_generator as qg


def test_generate_via_template_returns_requested_count():
    questions = qg.generate_via_template("science", 6)
    assert len(questions) == 6


def test_generate_via_template_each_question_has_four_unique_options():
    questions = qg.generate_via_template("history", 8)
    for q in questions:
        assert len(q["options"]) == 4
        assert len(set(q["options"])) == 4


def test_generate_via_template_correct_index_in_range():
    questions = qg.generate_via_template("geography", 5)
    for q in questions:
        assert 0 <= q["correctOptionIndex"] <= 3


def test_generate_via_template_sets_category():
    questions = qg.generate_via_template("mathematics", 3)
    assert all(q["category"] == "mathematics" for q in questions)


def test_generate_questions_falls_back_without_llm_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "")
    monkeypatch.setattr(qg, "LLM_PROVIDER", "")
    questions = qg.generate_questions("programming", 4)
    assert len(questions) == 4


def test_validate_question_rejects_wrong_option_count():
    bad = {"questionText": "Q?", "options": ["A", "B"], "correctOptionIndex": 0}
    assert qg._validate_question(bad) is False


def test_validate_question_rejects_out_of_range_index():
    bad = {
        "questionText": "Q?",
        "options": ["A", "B", "C", "D"],
        "correctOptionIndex": 9,
    }
    assert qg._validate_question(bad) is False


def test_validate_question_accepts_well_formed_question():
    good = {
        "questionText": "What is 2+2?",
        "options": ["3", "4", "5", "6"],
        "correctOptionIndex": 1,
    }
    assert qg._validate_question(good) is True


def test_generate_questions_rejects_unknown_category():
    try:
        qg.generate_questions("not-a-real-category", 3)
        assert False, "expected ValueError"
    except ValueError:
        pass
