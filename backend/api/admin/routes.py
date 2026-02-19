import logging
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status

from core.config import settings
from models.schemas import (
    AdminLoginResponse,
    AdminOtpRequest,
    AdminSmtpTestRequest,
    AdminSmtpTestResponse,
    AdminOtpVerifyRequest,
    QuestionCreate,
    QuestionResponse,
)
from services.question_service import (
    create_question,
    get_all_questions,
    delete_question,
    update_question,
)
from services.admin_auth_service import (
    request_admin_otp,
    send_smtp_test_email,
    verify_admin_otp,
    verify_admin_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin_auth(
    x_admin_key: str = Header(default=""),
    authorization: str = Header(default=""),
):
    # Secure admin access:
    # - Preferred: email OTP login then bearer token.
    # - Fallback: static admin key for local/dev backward compatibility.
    if settings.allow_admin_key_fallback and x_admin_key and x_admin_key == settings.admin_api_key:
        return

    if authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        verify_admin_token(token)
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing admin authentication.",
    )


def require_admin_setup_key(x_admin_key: str = Header(default="")):
    # Setup action used before OTP login flow; protect with static setup key.
    if not x_admin_key or x_admin_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing setup admin key.",
        )


@router.post("/auth/request-code")
def admin_request_code(payload: AdminOtpRequest):
    try:
        return request_admin_otp(payload.email)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("admin_request_code failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send code: {exc}",
        )


@router.post(
    "/auth/smtp-test",
    response_model=AdminSmtpTestResponse,
    dependencies=[Depends(require_admin_setup_key)],
)
def admin_smtp_test(payload: AdminSmtpTestRequest):
    try:
        result = send_smtp_test_email(payload.email)
        return AdminSmtpTestResponse(ok=True, message=result["message"])
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("admin_smtp_test failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SMTP test failed: {exc}",
        )


@router.post("/auth/verify-code", response_model=AdminLoginResponse)
def admin_verify_code(payload: AdminOtpVerifyRequest):
    try:
        token_data = verify_admin_otp(payload.email, payload.code)
        return AdminLoginResponse(
            access_token=str(token_data["access_token"]),
            token_type="bearer",
            expires_in_seconds=int(token_data["expires_in_seconds"]),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("admin_verify_code failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify code: {exc}",
        )


@router.post("/question", response_model=QuestionResponse, dependencies=[Depends(require_admin_auth)])
def add_question(payload: QuestionCreate):
    try:
        return create_question(payload)
    except Exception as exc:
        logger.exception("add_question failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create question: {exc}",
        )


@router.get("/questions", response_model=List[QuestionResponse], dependencies=[Depends(require_admin_auth)])
def list_questions():
    try:
        return get_all_questions()
    except Exception as exc:
        logger.exception("list_questions failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch questions: {exc}",
        )


@router.put("/question/{question_id}", response_model=QuestionResponse, dependencies=[Depends(require_admin_auth)])
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


@router.delete("/question/{question_id}", dependencies=[Depends(require_admin_auth)])
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

