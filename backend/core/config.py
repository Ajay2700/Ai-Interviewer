import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _split_origins(value: str) -> list[str]:
    raw = (value or "").strip()
    if not raw:
        return ["http://localhost:5173", "http://localhost:5174"]
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    # DATABASE_URL supports PostgreSQL in production (e.g., Supabase), SQLite locally.
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./interviewer.db")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    candidate_origin: str = os.getenv("CANDIDATE_FRONTEND_ORIGIN", "http://localhost:5173")
    admin_origin: str = os.getenv("ADMIN_FRONTEND_ORIGIN", "http://localhost:5174")
    allowed_origins_raw: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:5174",
    )
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    admin_api_key: str = os.getenv("ADMIN_API_KEY", "admin@123")
    admin_auth_secret: str = os.getenv("ADMIN_AUTH_SECRET", "")
    admin_allowed_email: str = os.getenv("ADMIN_ALLOWED_EMAIL", "")
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "")
    admin_otp_ttl_seconds: int = int(os.getenv("ADMIN_OTP_TTL_SECONDS", "300"))
    allow_admin_key_fallback: bool = os.getenv("ALLOW_ADMIN_KEY_FALLBACK", "false").lower() == "true"
    daily_tokens_free: int = int(os.getenv("DAILY_TOKENS_FREE", "1500"))
    daily_questions_free: int = int(os.getenv("DAILY_QUESTIONS_FREE", "5"))
    max_questions_per_interview: int = int(os.getenv("MAX_QUESTIONS_PER_INTERVIEW", "5"))
    max_ai_questions_per_interview: int = int(os.getenv("MAX_AI_QUESTIONS_PER_INTERVIEW", "2"))
    next_question_cooldown_seconds: int = int(os.getenv("NEXT_QUESTION_COOLDOWN_SECONDS", "5"))
    request_limit_per_minute: int = int(os.getenv("REQUEST_LIMIT_PER_MINUTE", "10"))
    max_audio_upload_bytes: int = int(os.getenv("MAX_AUDIO_UPLOAD_BYTES", str(5 * 1024 * 1024)))

    @property
    def allowed_origins(self) -> list[str]:
        return _split_origins(self.allowed_origins_raw)


settings = Settings()

