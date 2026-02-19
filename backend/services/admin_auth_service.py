import base64
import hashlib
import hmac
import json
import secrets
import smtplib
import time
from email.message import EmailMessage
from typing import Dict

from fastapi import HTTPException, status

from core.config import settings

# In-memory OTP cache for local/simple deployments.
_otp_store: Dict[str, Dict[str, int | str]] = {}
_TOKEN_TTL_SECONDS = 60 * 60


def _canonical_email(email: str) -> str:
    return (email or "").strip().lower()


def _is_email_allowed(email: str) -> bool:
    allowed = _canonical_email(settings.admin_allowed_email)
    if not allowed:
        # If no allowed email configured, keep behavior permissive for local dev.
        return True
    return _canonical_email(email) == allowed


def _send_email_otp(recipient: str, code: str) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL.")

    msg = EmailMessage()
    msg["Subject"] = "AI Interviewer Admin Login Code"
    msg["From"] = settings.smtp_from_email
    msg["To"] = recipient
    msg.set_content(
        f"Your admin login code is: {code}\n\n"
        f"This code expires in {settings.admin_otp_ttl_seconds // 60} minutes."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


def send_smtp_test_email(recipient: str) -> Dict[str, str]:
    canonical = _canonical_email(recipient)
    if not canonical:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid recipient email is required.",
        )
    if not _is_email_allowed(canonical):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not authorized for admin access.",
        )
    # Reuse OTP sender path to verify SMTP connectivity with a known payload.
    _send_email_otp(canonical, "123456")
    return {"message": f"SMTP is configured. Test email sent to {canonical}."}


def request_admin_otp(email: str) -> Dict[str, str | int]:
    canonical = _canonical_email(email)
    if not _is_email_allowed(canonical):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not authorized for admin access.",
        )

    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = int(time.time()) + settings.admin_otp_ttl_seconds
    _otp_store[canonical] = {"code": code, "expires_at": expires_at, "attempts": 0}

    _send_email_otp(canonical, code)
    return {"message": "Verification code sent.", "expires_in_seconds": settings.admin_otp_ttl_seconds}


def _sign_payload(payload_bytes: bytes) -> str:
    secret = settings.admin_auth_secret.encode("utf-8")
    return hmac.new(secret, payload_bytes, hashlib.sha256).hexdigest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_admin_token(email: str) -> Dict[str, str | int]:
    now = int(time.time())
    payload = {"email": _canonical_email(email), "iat": now, "exp": now + _TOKEN_TTL_SECONDS}
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    signature = _sign_payload(payload_bytes)
    token = f"{_b64(payload_bytes)}.{signature}"
    return {"access_token": token, "expires_in_seconds": _TOKEN_TTL_SECONDS}


def verify_admin_otp(email: str, code: str) -> Dict[str, str | int]:
    canonical = _canonical_email(email)
    entry = _otp_store.get(canonical)
    if not entry:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No active code found.")

    now = int(time.time())
    if now > int(entry["expires_at"]):
        _otp_store.pop(canonical, None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Code expired.")

    entry["attempts"] = int(entry["attempts"]) + 1
    if int(entry["attempts"]) > 5:
        _otp_store.pop(canonical, None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Too many attempts.")

    if str(entry["code"]) != (code or "").strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code.")

    _otp_store.pop(canonical, None)
    return create_admin_token(canonical)


def verify_admin_token(token: str) -> str:
    try:
        payload_part, signature = token.split(".", 1)
        payload_bytes = _b64_decode(payload_part)
        expected = _sign_payload(payload_bytes)
        if not hmac.compare_digest(signature, expected):
            raise ValueError("bad signature")
        payload = json.loads(payload_bytes.decode("utf-8"))
        now = int(time.time())
        if now > int(payload.get("exp", 0)):
            raise ValueError("expired")
        email = _canonical_email(str(payload.get("email", "")))
        if not email or not _is_email_allowed(email):
            raise ValueError("invalid email")
        return email
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin token.",
        )
