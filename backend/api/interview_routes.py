import logging
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status, UploadFile, File, Form

from models.schemas import (
    InterviewStartResponse,
    InterviewNextRequest,
    InterviewNextResponse,
    AnswerResponse,
)
from services.openai_service import (
    evaluate_answer,
    generate_question,
    generate_next_question_from_previous,
)
from services.question_service import get_questions
from services.whisper_service import transcribe_audio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interview", tags=["interview"])

# In-memory interview sessions for simple SQLite-based local setup.
_sessions: Dict[str, Dict[str, Any]] = {}


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
    role: str = Query(..., min_length=2),
    difficulty: str = Query(..., pattern="^(easy|medium|hard)$"),
):
    """
    Hybrid question source:
    - DB first for curated, deterministic interviewer questions.
    - AI fallback when no DB questions are available for role+difficulty.
    """
    try:
        db_questions = get_questions(role=role, difficulty=difficulty)
        interview_id = str(uuid4())

        if db_questions:
            first_question = db_questions[0].question
            source = "db"
            index = 0
        else:
            first_question = await generate_question(role)
            source = "ai"
            index = -1

        _sessions[interview_id] = {
            "role": role,
            "difficulty": difficulty,
            "db_questions": db_questions,
            "index": index,
        }

        return InterviewStartResponse(
            interview_id=interview_id,
            role=role,
            difficulty=difficulty,
            question=first_question,
            source=source,
            question_index=0,
        )
    except Exception as exc:
        logger.exception("start_interview failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview: {exc}",
        )


@router.post("/next", response_model=InterviewNextResponse)
async def next_interview_question(payload: InterviewNextRequest):
    """
    Next-question policy:
    1) Evaluate previous answer strictly.
    2) Serve next DB question if available.
    3) Otherwise generate AI follow-up using previous question+answer.
    """
    session = _sessions.get(payload.interview_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found. Start a new interview.",
        )

    try:
        role = session["role"]
        db_questions: List[Any] = session["db_questions"]
        current_index = int(session["index"])

        evaluation = await evaluate_answer(
            answer=payload.user_answer,
            question=payload.previous_question,
        )

        if db_questions and current_index + 1 < len(db_questions):
            current_index += 1
            session["index"] = current_index
            next_question = db_questions[current_index].question
            source = "db"
        else:
            next_question = await generate_next_question_from_previous(
                previous_question=payload.previous_question,
                user_answer=payload.user_answer,
                role=role,
            )
            source = "ai"

        return InterviewNextResponse(
            interview_id=payload.interview_id,
            question=next_question,
            source=source,
            question_index=max(current_index, 0),
            evaluation=evaluation,
        )
    except Exception as exc:
        logger.exception("next_interview_question failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get next question: {exc}",
        )


@router.post("/answer-audio", response_model=AnswerResponse)
async def answer_audio(
    audio: UploadFile = File(...),
    question: str = Form(...),
):
    if not _is_valid_audio_upload(audio):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an audio file.",
        )
    try:
        transcript = await transcribe_audio(audio)
        evaluation = await evaluate_answer(transcript, question=question)
        return AnswerResponse(transcript=transcript, evaluation=evaluation)
    except Exception as exc:
        logger.exception("answer_audio failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process audio answer: {exc}",
        )


@router.post("/answer", response_model=AnswerResponse)
async def answer_audio_alias(
    audio: UploadFile = File(...),
    question: str = Form(...),
):
    # Compatibility alias so clients using /api/interview/answer do not fail.
    return await answer_audio(audio=audio, question=question)

