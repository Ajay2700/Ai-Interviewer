import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_database_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return "sqlite:///./interviewer.db"
    # Some platforms provide `postgres://` which SQLAlchemy doesn't accept directly.
    if value.startswith("postgres://"):
        return "postgresql://" + value[len("postgres://") :]
    return value


def _split_origins(value: str) -> list[str]:
    raw = (value or "").strip()
    if not raw:
        return ["http://localhost:5173", "http://localhost:5174"]
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    # DATABASE_URL supports PostgreSQL in production (e.g., Supabase), SQLite locally.
    database_url: str = _normalize_database_url(os.getenv("DATABASE_URL", "postgresql://postgres:supabase%4019022026@db.bzjzvyfdkpypgxjlvzan.supabase.co:5432/postgres"))
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
    smtp_port: int = _env_int("SMTP_PORT", 587)
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "")
    admin_otp_ttl_seconds: int = _env_int("ADMIN_OTP_TTL_SECONDS", 300)
    allow_admin_key_fallback: bool = _env_bool("ALLOW_ADMIN_KEY_FALLBACK", False)
    daily_tokens_free: int = _env_int("DAILY_TOKENS_FREE", 1500)
    daily_questions_free: int = _env_int("DAILY_QUESTIONS_FREE", 5)
    max_questions_per_interview: int = _env_int("MAX_QUESTIONS_PER_INTERVIEW", 5)
    max_ai_questions_per_interview: int = _env_int("MAX_AI_QUESTIONS_PER_INTERVIEW", 2)
    next_question_cooldown_seconds: int = _env_int("NEXT_QUESTION_COOLDOWN_SECONDS", 5)
    request_limit_per_minute: int = _env_int("REQUEST_LIMIT_PER_MINUTE", 10)
    max_audio_upload_bytes: int = _env_int("MAX_AUDIO_UPLOAD_BYTES", 5 * 1024 * 1024)

    @property
    def allowed_origins(self) -> list[str]:
        return _split_origins(self.allowed_origins_raw)


settings = Settings()

