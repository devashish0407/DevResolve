"""
Global API Rate Limit & Quota Flag Manager
Tracks and raises real-time rate limit flags across all integrated services:
- Groq Cloud (HTTP 429 / TPM / RPM limits)
- Google Gemini (HTTP 429 / RESOURCE_EXHAUSTED)
- OpenAI (HTTP 429 / rate_limit_exceeded / insufficient_quota)
- Anthropic (HTTP 429 / rate_limit_error)
- GitHub REST API (HTTP 403 / 429 / x-ratelimit-remaining == 0)
- Internal Application Rate Limiting
"""

import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

# In-memory store for active rate limit flags
_ACTIVE_FLAGS: Dict[str, Dict[str, Any]] = {}


class RateLimitManager:
    @classmethod
    def raise_flag(
        cls,
        provider: str,
        model: Optional[str] = None,
        status_code: int = 429,
        error_message: str = "Rate limit or quota threshold reached.",
        retry_after_seconds: Optional[int] = None,
        recommendation: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Raises a rate limit flag for a specific provider/service.
        """
        now = time.time()
        # Default retry-after window if unspecified
        retry_seconds = retry_after_seconds if (retry_after_seconds and retry_after_seconds > 0) else 60

        if not recommendation:
            if provider == "groq":
                recommendation = (
                    "Groq free tier TPM/RPM limit hit. Wait for cooldown or switch to Google Gemini (1M context) "
                    "or local Ollama in AI Engine (BYOK)."
                )
            elif provider == "gemini":
                recommendation = (
                    "Google Gemini API quota reached. Switch to Groq Cloud (Ultra-Fast Free Tier) "
                    "or provide a paid Gemini API key in BYOK settings."
                )
            elif provider == "github":
                recommendation = (
                    "GitHub API rate limit exhausted. Provide a valid Personal Access Token (PAT) with repo scope "
                    "in Integrations to increase limit to 5,000 requests/hour."
                )
            else:
                recommendation = f"Rate limit reached for {provider.title()}. Please wait for cooldown or switch provider."

        flag_data = {
            "id": f"flag_{provider}_{int(now)}",
            "provider": provider.lower(),
            "model": model,
            "status_code": status_code,
            "error_message": error_message,
            "retry_after_seconds": retry_seconds,
            "flagged_at": datetime.now(timezone.utc).isoformat(),
            "expires_at_timestamp": now + retry_seconds,
            "recommendation": recommendation,
            "is_active": True,
        }

        _ACTIVE_FLAGS[provider.lower()] = flag_data
        print(f"[RATE_LIMIT_FLAG] Raised flag for {provider} (model: {model}, retry_after: {retry_seconds}s)")
        return flag_data

    @classmethod
    def get_active_flags(cls) -> List[Dict[str, Any]]:
        """Returns all currently active (non-expired) rate limit flags."""
        cls.cleanup_expired()
        return list(_ACTIVE_FLAGS.values())

    @classmethod
    def get_flag_for_provider(cls, provider: str) -> Optional[Dict[str, Any]]:
        """Returns active flag for a specific provider if active."""
        cls.cleanup_expired()
        return _ACTIVE_FLAGS.get(provider.lower())

    @classmethod
    def is_flagged(cls, provider: str) -> bool:
        """Returns True if provider currently has an active rate limit flag."""
        cls.cleanup_expired()
        return provider.lower() in _ACTIVE_FLAGS

    @classmethod
    def clear_flag(cls, provider: str) -> bool:
        """Clears the rate limit flag for a provider."""
        key = provider.lower()
        if key in _ACTIVE_FLAGS:
            del _ACTIVE_FLAGS[key]
            print(f"[RATE_LIMIT_FLAG] Cleared flag for {provider}")
            return True
        return False

    @classmethod
    def cleanup_expired(cls) -> None:
        """Removes flags whose retry window has elapsed."""
        now = time.time()
        expired_keys = [k for k, v in _ACTIVE_FLAGS.items() if v.get("expires_at_timestamp", 0) <= now]
        for k in expired_keys:
            del _ACTIVE_FLAGS[k]
