import logging
from datetime import datetime, timezone

import openai

logger = logging.getLogger(__name__)

# Most recent provider failure, surfaced by /health so billing or key problems are visible
# without digging through logs. Cleared again by the next successful call.
last_ai_error: dict | None = None


class AIServiceUnavailable(RuntimeError):
    """The AI provider could not serve a request (billing, quota, API key, or network)."""

    def __init__(self, feature: str, reason: str):
        super().__init__(f"AI {feature} unavailable ({reason})")
        self.feature = feature
        self.reason = reason


def _failure_reason(exc: Exception) -> str:
    # OpenAI error codes such as billing_not_active / insufficient_quota / invalid_api_key
    # say exactly what the operator has to fix, so prefer them over the HTTP status.
    code = getattr(exc, "code", None)
    if code:
        return str(code)
    if "OPENAI_API_KEY" in str(exc):
        return "missing_api_key"
    if isinstance(exc, openai.AuthenticationError):
        return "invalid_api_key"
    if isinstance(exc, openai.APIConnectionError):
        return "connection_error"
    if isinstance(exc, openai.RateLimitError):
        return "rate_limited"
    if isinstance(exc, openai.APIStatusError):
        return f"http_{exc.status_code}"
    return exc.__class__.__name__


def provider_failure(feature: str, exc: Exception) -> AIServiceUnavailable:
    """Log a provider error, remember it for /health, and wrap it for the API layer."""
    global last_ai_error
    reason = _failure_reason(exc)
    last_ai_error = {
        "reason": reason,
        "feature": feature,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    logger.error("OpenAI %s failed (%s): %s", feature, reason, exc)
    return AIServiceUnavailable(feature, reason)


def provider_ok() -> None:
    global last_ai_error
    last_ai_error = None
