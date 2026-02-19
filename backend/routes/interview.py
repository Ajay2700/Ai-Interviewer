from typing import Any, Dict, List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi import status
import json
import logging

from models.schemas import QuestionResponse, AnswerResponse
from services.openai_service import generate_question, evaluate_answer, generate_followup_question
from services.whisper_service import transcribe_audio

router = APIRouter(prefix="/interview", tags=["interview"])
legacy_router = APIRouter(prefix="", tags=["interview"])
logger = logging.getLogger(__name__)


@router.get("/question", response_model=QuestionResponse)
async def get_question(role: str = "frontend developer"):
    try:
        question = await generate_question(role)
        return QuestionResponse(role=role, question=question)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate question: {e}",
        )


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(
    audio: UploadFile = File(...),
    question: str = Form(""),
):
    if not (audio.content_type or "").startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an audio file.",
        )

    try:
        transcript = await transcribe_audio(audio)
        evaluation = await evaluate_answer(transcript, question=question)
        return AnswerResponse(transcript=transcript, evaluation=evaluation)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("submit_answer failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process answer: {e}",
        )


@router.post("/conversational")
async def conversational_turn(
    role: str = Form(...),
    current_question: str = Form(...),
    history_json: str = Form("[]"),
    audio: UploadFile = File(...),
):
    """
    Single conversational turn:
    - transcribe audio
    - evaluate answer
    - generate next question based on full history (including this turn)

    history_json: JSON-encoded list of {question, answer, score}
    """
    if not (audio.content_type or "").startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an audio file.",
        )

    try:
        try:
            history_raw: List[Dict[str, Any]] = json.loads(history_json or "[]")
            history: List[Dict[str, Any]] = (
                history_raw if isinstance(history_raw, list) else []
            )
        except json.JSONDecodeError:
            history = []

        if len(history) > 20:
            history = history[-20:]

        transcript = await transcribe_audio(audio)
        evaluation = await evaluate_answer(transcript, question=current_question)

        updated_history = history + [
            {
                "question": current_question,
                "answer": transcript,
                "score": evaluation.get("score"),
            }
        ]

        next_question = await generate_followup_question(role=role, history=updated_history)

        return {
            "transcript": transcript,
            "evaluation": evaluation,
            "next_question": next_question,
            "history": updated_history,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("conversational_turn failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process conversational turn: {e}",
        )


# Legacy endpoints to keep /api/question and /api/answer working
@legacy_router.get("/question", response_model=QuestionResponse)
async def legacy_get_question(role: str = "frontend developer"):
    return await get_question(role)


@legacy_router.post("/answer", response_model=AnswerResponse)
async def legacy_submit_answer(audio: UploadFile = File(...), question: str = Form("")):
    return await submit_answer(audio=audio, question=question)


@legacy_router.post("/conversational")
async def legacy_conversational_turn(
    role: str = Form(...),
    current_question: str = Form(...),
    history_json: str = Form("[]"),
    audio: UploadFile = File(...),
):
    return await conversational_turn(
        role=role,
        current_question=current_question,
        history_json=history_json,
        audio=audio,
    )

