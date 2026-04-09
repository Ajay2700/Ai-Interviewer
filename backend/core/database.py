import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from sqlalchemy import DateTime, Integer, String, Text, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from core.config import settings

logger = logging.getLogger(__name__)

_SQLITE_FALLBACK_URL = "sqlite:///./interviewer_local.db"


def _is_sqlite_url(url: str) -> bool:
    return (url or "").strip().lower().startswith("sqlite")


def _build_engine(url: str):
    is_sqlite = _is_sqlite_url(url)
    kwargs: dict = {
        "pool_pre_ping": True,
        "future": True,
    }
    if is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PgBouncer / Supabase transaction pooler friendly settings.
        kwargs["pool_size"] = 3
        kwargs["max_overflow"] = 2
        kwargs["pool_recycle"] = 300
        kwargs["pool_timeout"] = 10
    return create_engine(url, **kwargs)


def _sqlite_fallback_engine():
    logger.warning(
        "Switching to SQLite fallback at '%s'. "
        "Set DATABASE_URL correctly in Render environment variables to use PostgreSQL.",
        _SQLITE_FALLBACK_URL,
    )
    return _build_engine(_SQLITE_FALLBACK_URL)


# Module-level engine and session factory — updated in init_db() if fallback is needed.
engine = _build_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    total_tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_questions_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    questions_attempted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_usage_day: Mapped[str] = mapped_column(String(32), nullable=False)


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(120), nullable=False, default="General")
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(24), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class UsageLog(Base):
    __tablename__ = "usage_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False)
    endpoint: Mapped[str] = mapped_column(String(200), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    session_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(24), nullable=False)
    mode: Mapped[str] = mapped_column(String(24), nullable=False)
    question_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_questions_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    last_question_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RequestLog(Base):
    __tablename__ = "request_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requester_key: Mapped[str] = mapped_column(String(128), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(200), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


@contextmanager
def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def init_db() -> None:
    """Create all tables. Falls back to SQLite if the primary DB is unreachable."""
    global engine, SessionLocal  # noqa: PLW0603

    # --- try primary DB first ---
    try:
        # Quick connectivity check before attempting DDL.
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
        url_hint = str(engine.url).split("@")[-1] if "@" in str(engine.url) else str(engine.url)
        logger.info("Database ready: %s", url_hint)
        return
    except Exception as exc:
        if _is_sqlite_url(str(engine.url)):
            # Already on SQLite and it still failed — log and give up gracefully.
            logger.error("SQLite init_db failed: %s", exc)
            return
        logger.warning(
            "Primary database unreachable (%s: %s). Falling back to SQLite.",
            exc.__class__.__name__,
            exc,
        )

    # --- fall back to SQLite ---
    try:
        engine = _sqlite_fallback_engine()
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=engine)
        logger.info("SQLite fallback database ready at '%s'.", _SQLITE_FALLBACK_URL)
    except Exception as exc2:
        logger.error("SQLite fallback init_db also failed: %s", exc2)
