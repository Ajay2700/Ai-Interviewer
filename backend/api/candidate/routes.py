import logging
import json
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from core.config import settings
from models.schemas import (
    AnswerResponse,
    InterviewNextRequest,
    InterviewNextResponse,
    InterviewStartResponse,
    ProctoringLogRequest,
    ProctoringLogResponse,
    UsageSummaryResponse,
)
from services.openai_service import evaluate_answer, generate_ai_question, generate_followup_question
from services.question_service import get_company_questions
from services.speech_service import transcribe_audio
from services.usage_service import (
    check_question_limit,
    enforce_interview_limits_or_raise,
    enforce_next_question_cooldown_or_raise,
    get_usage_summary,
    increment_question_usage,
    create_or_reset_session,
    validate_session_or_raise,
    advance_session_state,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interview", tags=["candidate"])

MAX_QUESTIONS = settings.max_questions_per_interview
HYBRID_DB_QUESTIONS = 3
LOGS_DIR = Path(__file__).resolve().parents[2] / "logs" / "proctoring"


def _is_valid_audio_upload(audio: UploadFile) -> bool:
    content_type = (audio.content_type or "").lower()
    filename = (audio.filename or "").lower()
    if content_type.startswith("audio/"):
        return True
    if content_type == "application/octet-stream" and filename.endswith(
        (".wav", ".mp3", ".m4a", ".webm", ".ogg")
    ):
        return True
    return False


@router.get("/start", response_model=InterviewStartResponse)
async def start_interview(
    user_id: str = Query(..., min_length=2),
    role: str = Query(..., min_length=2),
    difficulty: str = Query(..., pattern="^(easy|medium|hard)$"),
    mode: Literal["company", "ai", "hybrid"] = Query("hybrid"),
):
    """
    Start interview with selected mode.

    - Company mode uses only DB questions for standardized evaluation.
    - AI mode uses only generated questions for adaptability.
    - Hybrid mode combines both: curated baseline + dynamic follow-ups.
    """
    try:
        check_question_limit(user_id)
        session_id = str(uuid4())
        company_questions = get_company_questions(
            role=role,
            difficulty=difficulty,
            limit=HYBRID_DB_QUESTIONS if mode == "hybrid" else MAX_QUESTIONS,
            shuffle=False,
        )

        if mode == "company":
            if company_questions:
                question = company_questions[0].question
                source = "database"
            else:
                # Fallback keeps interview running if DB has no matching questions.
                question = await generate_ai_question(role=role, difficulty=difficulty, user_id=user_id)
                source = "ai"
        elif mode == "ai":
            question = await generate_ai_question(role=role, difficulty=difficulty, user_id=user_id)
            source = "ai"
        else:
            # Hybrid: DB first for consistency, AI later for adaptability.
            if company_questions:
                question = company_questions[0].question
                source = "database"
            else:
                question = await generate_ai_question(role=role, difficulty=difficulty, user_id=user_id)
                source = "ai"

        create_or_reset_session(
            session_id=session_id,
            user_id=user_id,
            role=role,
            difficulty=difficulty,
            mode=mode,
        )
        increment_question_usage(user_id)

        return InterviewStartResponse(
            session_id=session_id,
            user_id=user_id,
            question=question,
            mode=mode,
            source=source,
            question_index=0,
            db_questions_count=len(company_questions),
        )
    except Exception as exc:
        logger.exception("start_interview failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview: {exc}",
        )


@router.post("/next", response_model=InterviewNextResponse)
async def next_question(payload: InterviewNextRequest):
    """
    Return next question based on selected interview mode.
    """
    try:
        if not (payload.user_answer or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Answer required before requesting next question.",
            )
        session = validate_session_or_raise(payload.session_id, payload.user_id)
        enforce_next_question_cooldown_or_raise(session)
        check_question_limit(payload.user_id)

        next_index = int(payload.question_index) + 1

        company_questions = get_company_questions(
            role=payload.role,
            difficulty=payload.difficulty,
            limit=HYBRID_DB_QUESTIONS if payload.mode == "hybrid" else MAX_QUESTIONS,
            shuffle=False,
        )

        if payload.mode == "company":
            if next_index < len(company_questions):
                question = company_questions[next_index].question
                source = "database"
            else:
                question = await generate_ai_question(
                    role=payload.role,
                    difficulty=payload.difficulty,
                    user_id=payload.user_id,
                )
                source = "ai"
        elif payload.mode == "ai":
            question = await generate_followup_question(
                previous_question=payload.previous_question,
                user_answer=payload.user_answer,
                role=payload.role,
                difficulty=payload.difficulty,
                user_id=payload.user_id,
            )
            source = "ai"
        else:
            if next_index < len(company_questions):
                question = company_questions[next_index].question
                source = "database"
            else:
                question = await generate_followup_question(
                    previous_question=payload.previous_question,
                    user_answer=payload.user_answer,
                    role=payload.role,
                    difficulty=payload.difficulty,
                    user_id=payload.user_id,
                )
                source = "ai"

        enforce_interview_limits_or_raise(session, next_question_index=next_index, next_source=source)
        advance_session_state(
            payload.session_id,
            payload.user_id,
            next_question_index=next_index,
            source=source,
        )
        increment_question_usage(payload.user_id)

        return InterviewNextResponse(
            session_id=payload.session_id,
            user_id=payload.user_id,
            question=question,
            mode=payload.mode,
            source=source,
            question_index=next_index,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("next_question failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get next question: {exc}",
        )


@router.post("/answer", response_model=AnswerResponse)
async def answer(
    audio: UploadFile = File(...),
    question: str = Form(...),
    user_id: str = Form(""),
):
    if not _is_valid_audio_upload(audio):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an audio file.",
        )
    try:
        transcript = await transcribe_audio(audio, max_bytes=settings.max_audio_upload_bytes)
        evaluation = await evaluate_answer(answer=transcript, question=question, user_id=user_id or None)
        return AnswerResponse(transcript=transcript, evaluation=evaluation)
    except Exception as exc:
        logger.exception("answer failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process answer: {exc}",
        )


@router.get("/usage", response_model=UsageSummaryResponse)
async def usage(user_id: str = Query(..., min_length=2)):
    try:
        return UsageSummaryResponse(**get_usage_summary(user_id))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("usage failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch usage: {exc}",
        )


@router.post("/proctor-log", response_model=ProctoringLogResponse)
async def save_proctoring_log(payload: ProctoringLogRequest):
    """
    Persist per-candidate proctoring activity as JSONL.

    Note:
    Browser apps cannot enumerate every installed extension/tool, but they can
    log detectable risk signals (tab switch, blur, blocked shortcuts, face/gaze events).
    """
    try:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        safe_candidate = "".join(c for c in payload.candidate_id if c.isalnum() or c in ("-", "_"))
        if not safe_candidate:
            safe_candidate = "unknown_candidate"
        log_path = LOGS_DIR / f"{safe_candidate}.jsonl"

        log_record = {
            "server_received_at": datetime.now(timezone.utc).isoformat(),
            "candidate_id": payload.candidate_id,
            "session_id": payload.session_id,
            "role": payload.role,
            "difficulty": payload.difficulty,
            "mode": payload.mode,
            "status": payload.status,
            "violations": payload.violations,
            "terminated": payload.terminated,
            "events": [event.model_dump() for event in payload.events],
        }

        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(log_record, ensure_ascii=True) + "\n")

        return ProctoringLogResponse(
            ok=True,
            log_file=str(log_path),
            events_stored=len(payload.events),
        )
    except Exception as exc:
        logger.exception("save_proctoring_log failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save proctoring log: {exc}",
        )

