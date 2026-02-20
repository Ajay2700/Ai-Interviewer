import base64
import hashlib
import hmac
import json
import secrets
import socket
import smtplib
import time
from email.message import EmailMessage
from typing import Dict

import httpx
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
    subject = "AI Interviewer Admin Login Code"
    body = (
        f"Your admin login code is: {code}\n\n"
        f"This code expires in {settings.admin_otp_ttl_seconds // 60} minutes."
    )

    smtp_error: Exception | None = None
    if settings.smtp_host and settings.smtp_from_email:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = settings.smtp_from_email
            msg["To"] = recipient
            msg.set_content(body)

            security_mode = (settings.smtp_security or "starttls").strip().lower()
            if security_mode not in {"starttls", "ssl", "none"}:
                raise RuntimeError("Invalid SMTP_SECURITY. Use one of: starttls, ssl, none.")
            with _smtp_client(use_ssl=security_mode == "ssl") as server:
                if security_mode == "starttls":
                    server.starttls()
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            return
        except Exception as exc:
            smtp_error = exc

    # Fallback for deployments where SMTP egress is blocked.
    if settings.resend_api_key and settings.resend_from_email:
        _send_via_resend(recipient=recipient, subject=subject, body=body)
        return

    if smtp_error is not None:
        raise RuntimeError(
            "SMTP connection failed and no Resend fallback configured. "
            "Set RESEND_API_KEY and RESEND_FROM_EMAIL or fix SMTP_HOST/SMTP_PORT."
        ) from smtp_error
    raise RuntimeError(
        "Email provider is not configured. Configure SMTP_* or RESEND_API_KEY + RESEND_FROM_EMAIL."
    )


def _send_via_resend(*, recipient: str, subject: str, body: str) -> None:
    payload = {
        "from": settings.resend_from_email,
        "to": [recipient],
        "subject": subject,
        "text": body,
    }
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            json=payload,
            headers=headers,
            timeout=20,
        )
        if response.status_code >= 400:
            detail = response.text
            try:
                parsed = response.json()
                if isinstance(parsed, dict):
                    detail = str(parsed.get("message") or parsed.get("error") or parsed)
            except Exception:
                pass
            raise RuntimeError(f"Resend API error ({response.status_code}): {detail}")
    except Exception as exc:
        raise RuntimeError(f"Resend email fallback failed: {exc}") from exc


def _smtp_client(*, use_ssl: bool = False) -> smtplib.SMTP:
    """
    Create SMTP connection with IPv4 fallback.

    Some cloud networks can fail on IPv6 routes and raise:
    [Errno 101] Network is unreachable.
    """
    last_error: Exception | None = None
    smtp_ctor = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    try:
        return smtp_ctor(settings.smtp_host, settings.smtp_port, timeout=20)
    except OSError as exc:
        last_error = exc

    try:
        infos = socket.getaddrinfo(
            settings.smtp_host,
            settings.smtp_port,
            family=socket.AF_INET,
            type=socket.SOCK_STREAM,
        )
        for family, socktype, proto, _canonname, sockaddr in infos:
            ip, port = sockaddr[0], sockaddr[1]
            try:
                server = smtp_ctor(timeout=20)
                server.connect(ip, port)
                return server
            except OSError as exc:
                last_error = exc
                continue
    except OSError as exc:
        last_error = exc

    raise RuntimeError(
        "SMTP connection failed. Verify SMTP_HOST/SMTP_PORT and provider network access."
    ) from last_error


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
