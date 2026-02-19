import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from api.admin.routes import router as admin_router
from api.candidate.routes import router as candidate_router
from core.config import settings
from core.database import init_db
from services.usage_service import record_request

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    # Load environment variables from .env file if present
    load_dotenv()
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    app = FastAPI(title="AI Interviewer API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        # Restrict CORS to configured frontend origins in production.
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Admin and candidate routes are intentionally split for security and scalability.
    app.include_router(admin_router, prefix="/api")
    app.include_router(candidate_router, prefix="/api")

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        # Per-user/IP request limiting to reduce abuse and cost explosions.
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        user_id = request.headers.get("x-user-id", "").strip()
        requester_key = user_id or (request.client.host if request.client else "unknown")
        hits = record_request(requester_key=requester_key, endpoint=path)
        if hits > settings.request_limit_per_minute:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
            )
        logger.info("request path=%s requester=%s hits_last_min=%s", path, requester_key, hits)
        return await call_next(request)

    @app.on_event("startup")
    def _startup():
        init_db()

    return app


app = create_app()


@app.get("/health")
def health_check():
    return {"status": "ok"}

