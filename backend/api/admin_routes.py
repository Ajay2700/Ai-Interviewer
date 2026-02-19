import logging
from typing import List

from fastapi import APIRouter, HTTPException, status

from models.schemas import QuestionCreate, QuestionResponse
from services.question_service import (
    create_question,
    get_all_questions,
    delete_question,
    update_question,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/question", response_model=QuestionResponse)
def add_question(payload: QuestionCreate):
    try:
        return create_question(payload)
    except Exception as exc:
        logger.exception("add_question failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create question: {exc}",
        )


@router.get("/questions", response_model=List[QuestionResponse])
def list_questions():
    try:
        return get_all_questions()
    except Exception as exc:
        logger.exception("list_questions failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch questions: {exc}",
        )


@router.put("/question/{question_id}", response_model=QuestionResponse)
def edit_question(question_id: int, payload: QuestionCreate):
    try:
        updated = update_question(question_id, payload)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("edit_question failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update question: {exc}",
        )


@router.delete("/question/{question_id}")
def remove_question(question_id: int):
    try:
        ok = delete_question(question_id)
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("remove_question failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete question: {exc}",
        )

