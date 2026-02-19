from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status

from core.config import settings
from core.database import InterviewSession, RequestLog, UsageLog, User, get_db, utc_now


def _today_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def ensure_user(user_id: str) -> None:
    with get_db() as db:
        row = db.query(User).filter(User.id == user_id).first()
        if row:
            return
        today = _today_utc()
        db.add(
            User(
                id=user_id,
                created_at=utc_now(),
                plan="free",
                total_tokens_used=0,
                daily_tokens_used=0,
                daily_questions_used=0,
                questions_attempted=0,
                last_usage_day=today,
            )
        )
        db.commit()


def _reset_daily_if_needed(user_id: str) -> None:
    today = _today_utc()
    with get_db() as db:
        row = db.query(User).filter(User.id == user_id).first()
        if not row:
            return
        if (row.last_usage_day or "") != today:
            row.daily_tokens_used = 0
            row.daily_questions_used = 0
            row.last_usage_day = today
            db.commit()


def get_usage_summary(user_id: str) -> Dict[str, Any]:
    ensure_user(user_id)
    _reset_daily_if_needed(user_id)
    with get_db() as db:
        row = db.query(User).filter(User.id == user_id).first()
        plan = (row.plan or "free").lower()
        daily_tokens_limit = settings.daily_tokens_free
        daily_questions_limit = settings.daily_questions_free
        # Simple production knob: paid plans can use larger limits.
        if plan == "pro":
            daily_tokens_limit = settings.daily_tokens_free * 10
            daily_questions_limit = settings.daily_questions_free * 5

        return {
            "user_id": row.id,
            "plan": plan,
            "total_tokens_used": int(row.total_tokens_used),
            "daily_tokens_used": int(row.daily_tokens_used),
            "daily_questions_used": int(row.daily_questions_used),
            "questions_attempted": int(row.questions_attempted),
            "daily_tokens_limit": daily_tokens_limit,
            "daily_questions_limit": daily_questions_limit,
            "questions_left_today": max(0, daily_questions_limit - int(row.daily_questions_used)),
            "tokens_left_today": max(0, daily_tokens_limit - int(row.daily_tokens_used)),
        }


def check_token_limit(user_id: str) -> None:
    usage = get_usage_summary(user_id)
    if usage["daily_tokens_used"] >= usage["daily_tokens_limit"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily token limit exceeded.",
        )


def check_question_limit(user_id: str) -> None:
    usage = get_usage_summary(user_id)
    if usage["daily_questions_used"] >= usage["daily_questions_limit"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Question limit reached. Please try again tomorrow.",
        )


def increment_question_usage(user_id: str) -> None:
    ensure_user(user_id)
    _reset_daily_if_needed(user_id)
    with get_db() as db:
        row = db.query(User).filter(User.id == user_id).first()
        row.daily_questions_used += 1
        row.questions_attempted += 1
        db.commit()


def update_usage(user_id: str, tokens: int, endpoint: str) -> None:
    tokens = max(0, int(tokens or 0))
    ensure_user(user_id)
    _reset_daily_if_needed(user_id)
    with get_db() as db:
        db.add(
            UsageLog(
                user_id=user_id,
                tokens_used=tokens,
                endpoint=endpoint,
                timestamp=utc_now(),
            )
        )
        row = db.query(User).filter(User.id == user_id).first()
        row.total_tokens_used += tokens
        row.daily_tokens_used += tokens
        db.commit()


def create_or_reset_session(
    session_id: str,
    user_id: str,
    role: str,
    difficulty: str,
    mode: str,
) -> None:
    now = utc_now()
    with get_db() as db:
        row = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
        if not row:
            row = InterviewSession(
                session_id=session_id,
                user_id=user_id,
                role=role,
                difficulty=difficulty,
                mode=mode,
                question_index=0,
                ai_questions_used=0,
                status="active",
                last_question_at=now,
                created_at=now,
            )
            db.add(row)
        else:
            row.user_id = user_id
            row.role = role
            row.difficulty = difficulty
            row.mode = mode
            row.question_index = 0
            row.ai_questions_used = 0
            row.status = "active"
            row.last_question_at = now
            row.created_at = now
        db.commit()


def get_session(session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as db:
        row = (
            db.query(InterviewSession)
            .filter(InterviewSession.session_id == session_id)
            .filter(InterviewSession.user_id == user_id)
            .first()
        )
        if not row:
            return None
        return {
            "session_id": row.session_id,
            "user_id": row.user_id,
            "role": row.role,
            "difficulty": row.difficulty,
            "mode": row.mode,
            "question_index": row.question_index,
            "ai_questions_used": row.ai_questions_used,
            "status": row.status,
            "last_question_at": row.last_question_at.isoformat() if row.last_question_at else "",
            "created_at": row.created_at.isoformat() if row.created_at else "",
        }


def validate_session_or_raise(session_id: str, user_id: str) -> Dict[str, Any]:
    session = get_session(session_id=session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found. Start a new interview.",
        )
    if str(session.get("status", "")) != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview session is no longer active.",
        )
    return session


def enforce_next_question_cooldown_or_raise(session: Dict[str, Any]) -> None:
    last_question_at = str(session.get("last_question_at", "")).strip()
    if not last_question_at:
        return
    try:
        last_dt = datetime.fromisoformat(last_question_at.replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        elapsed = (now_dt - last_dt).total_seconds()
        if elapsed < settings.next_question_cooldown_seconds:
            wait_for = int(settings.next_question_cooldown_seconds - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_for} seconds before requesting the next question.",
            )
    except HTTPException:
        raise
    except Exception:
        # Ignore parse issues and allow request.
        return


def advance_session_state(
    session_id: str,
    user_id: str,
    *,
    next_question_index: int,
    source: str,
) -> None:
    with get_db() as db:
        row = (
            db.query(InterviewSession)
            .filter(InterviewSession.session_id == session_id)
            .filter(InterviewSession.user_id == user_id)
            .first()
        )
        if not row:
            return
        row.question_index = next_question_index
        if source == "ai":
            row.ai_questions_used += 1
        row.last_question_at = utc_now()
        db.commit()


def enforce_interview_limits_or_raise(
    session: Dict[str, Any],
    *,
    next_question_index: int,
    next_source: str,
) -> None:
    if next_question_index >= settings.max_questions_per_interview:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question limit reached. Please try again tomorrow.",
        )
    if next_source == "ai" and int(session.get("ai_questions_used", 0)) >= settings.max_ai_questions_per_interview:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI follow-up question limit reached for this interview.",
        )


def record_request(requester_key: str, endpoint: str) -> int:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=60)
    with get_db() as db:
        db.query(RequestLog).filter(RequestLog.timestamp < cutoff).delete(synchronize_session=False)
        db.add(RequestLog(requester_key=requester_key, endpoint=endpoint, timestamp=now))
        db.commit()
        count = (
            db.query(RequestLog)
            .filter(RequestLog.requester_key == requester_key)
            .filter(RequestLog.timestamp >= cutoff)
            .count()
        )
        return int(count)

