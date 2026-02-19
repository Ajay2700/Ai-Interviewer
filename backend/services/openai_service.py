import json
import logging
import os
import time
from typing import Any, Dict, List, Tuple

from dotenv import load_dotenv
from openai import OpenAI

from core.config import settings
from services.usage_service import check_token_limit, update_usage
from utils.prompts import CONVERSATION_FOLLOWUP_PROMPT, EVALUATION_PROMPT

_client: OpenAI | None = None
logger = logging.getLogger(__name__)

# In-memory cache to reduce repeated question generation costs.
_QUESTION_CACHE: Dict[Tuple[str, str], Dict[str, Any]] = {}
_QUESTION_CACHE_TTL_SECONDS = 180


def get_client() -> OpenAI:
    global _client
    if _client is None:
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = OpenAI(api_key=api_key)
    return _client


def _extract_total_tokens(response: Any) -> int:
    usage = getattr(response, "usage", None)
    total = getattr(usage, "total_tokens", 0) if usage is not None else 0
    try:
        return max(0, int(total or 0))
    except (TypeError, ValueError):
        return 0


def _track_usage_if_needed(user_id: str | None, response: Any, endpoint: str) -> None:
    if not user_id:
        return
    tokens = _extract_total_tokens(response)
    if tokens > 0:
        update_usage(user_id=user_id, tokens=tokens, endpoint=endpoint)


def _get_cached_question(role: str, difficulty: str) -> str:
    key = (role.strip().lower(), difficulty.strip().lower())
    entry = _QUESTION_CACHE.get(key)
    if not entry:
        return ""
    if (time.time() - float(entry["ts"])) > _QUESTION_CACHE_TTL_SECONDS:
        _QUESTION_CACHE.pop(key, None)
        return ""
    return str(entry["question"])


def _set_cached_question(role: str, difficulty: str, question: str) -> None:
    key = (role.strip().lower(), difficulty.strip().lower())
    _QUESTION_CACHE[key] = {"question": question, "ts": time.time()}


async def generate_ai_question(role: str, difficulty: str, user_id: str | None = None) -> str:
    if user_id:
        check_token_limit(user_id)

    cached = _get_cached_question(role, difficulty)
    if cached:
        return cached

    client = get_client()
    prompt = f"Generate one {difficulty} interview question for {role}. Return only the question."
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You generate concise technical interview questions."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=150,
    )
    _track_usage_if_needed(user_id=user_id, response=response, endpoint="/openai/question")
    question = (response.choices[0].message.content or "").strip()
    if question:
        _set_cached_question(role, difficulty, question)
    return question


async def generate_question(role: str) -> str:
    # Backward compatible wrapper for old call sites.
    return await generate_ai_question(role=role, difficulty="medium", user_id=None)


async def evaluate_answer(answer: str, question: str, user_id: str | None = None) -> Dict[str, Any]:
    if user_id:
        check_token_limit(user_id)
    client = get_client()
    prompt = EVALUATION_PROMPT.format(answer=answer, question=question)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a strict senior interviewer."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=400,
        response_format={"type": "json_object"},
    )
    _track_usage_if_needed(user_id=user_id, response=response, endpoint="/openai/evaluate")
    raw_content = response.choices[0].message.content or ""
    try:
        data = json.loads(raw_content)
    except json.JSONDecodeError:
        raw_content = raw_content.strip().strip("`")
        start = raw_content.find("{")
        end = raw_content.rfind("}") + 1
        if start != -1 and end != -1:
            data = json.loads(raw_content[start:end])
        else:
            raise

    data.setdefault("score", 0)
    data.setdefault("confidence", 0)
    data.setdefault("strengths", [])
    data.setdefault("weaknesses", [])
    data.setdefault("improvements", [])
    data.setdefault("verdict", "fail")
    data.setdefault("feedback", "")
    try:
        data["score"] = int(data.get("score", 0))
    except (TypeError, ValueError):
        data["score"] = 0
    try:
        data["confidence"] = int(data.get("confidence", 0))
    except (TypeError, ValueError):
        data["confidence"] = 0
    data["score"] = max(0, min(10, data["score"]))
    data["confidence"] = max(0, min(100, data["confidence"]))
    for key in ["strengths", "weaknesses", "improvements"]:
        if not isinstance(data.get(key), list):
            val = data.get(key)
            data[key] = [str(val)] if val is not None else []
    verdict = str(data.get("verdict", "fail")).strip().lower()
    data["verdict"] = "pass" if verdict == "pass" else "fail"
    if not isinstance(data.get("feedback"), str):
        data["feedback"] = str(data["feedback"])
    if not answer.strip():
        data["score"] = 0
        data["verdict"] = "fail"
        if not data["weaknesses"]:
            data["weaknesses"] = ["No relevant answer provided."]
        if not data["feedback"]:
            data["feedback"] = "The answer is missing or irrelevant."
    logger.info(
        "Evaluation generated score=%s confidence=%s verdict=%s",
        data["score"],
        data["confidence"],
        data["verdict"],
    )
    return data


async def generate_followup_from_history(
    role: str,
    history: List[Dict[str, Any]],
    user_id: str | None = None,
) -> str:
    if user_id:
        check_token_limit(user_id)
    client = get_client()
    trimmed_history = history[-8:]
    history_text_lines = []
    for idx, item in enumerate(trimmed_history, start=1):
        q = item.get("question", "").strip()
        a = item.get("answer", "").strip()
        s = item.get("score")
        line = f"{idx}. Q: {q}\n   A: {a}"
        if s is not None:
            line += f"\n   Score: {s}/10"
        history_text_lines.append(line)
    history_text = "\n\n".join(history_text_lines) or "No previous questions yet."
    prompt = CONVERSATION_FOLLOWUP_PROMPT.format(role=role, history=history_text)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You orchestrate a structured technical interview."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=150,
    )
    _track_usage_if_needed(user_id=user_id, response=response, endpoint="/openai/followup-history")
    return (response.choices[0].message.content or "").strip()


async def generate_followup_question(
    previous_question: str,
    user_answer: str,
    role: str,
    difficulty: str,
    user_id: str | None = None,
) -> str:
    if user_id:
        check_token_limit(user_id)
    client = get_client()
    prompt = (
        "Based on this question and answer, generate a follow-up interview question.\n\n"
        f"Role: {role}\n"
        f"Difficulty: {difficulty}\n"
        f"Question: {previous_question}\n"
        f"Answer: {user_answer}\n\n"
        "Return only the question."
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You generate strict, role-relevant interview questions."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=150,
    )
    _track_usage_if_needed(user_id=user_id, response=response, endpoint="/openai/followup")
    return (response.choices[0].message.content or "").strip()


async def generate_next_question_from_previous(
    previous_question: str,
    user_answer: str,
    role: str,
) -> str:
    return await generate_followup_question(
        previous_question=previous_question,
        user_answer=user_answer,
        role=role,
        difficulty="medium",
        user_id=None,
    )

