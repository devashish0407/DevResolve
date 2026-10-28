"""
Global API Rate Limit, Quota & Alert Cooldown Manager
Tracks and raises real-time rate limit flags across all integrated services:
- Groq Cloud (HTTP 429: TPM/RPM temporary burst vs TPD daily quota exhaustion)
- Google Gemini (HTTP 429 / RESOURCE_EXHAUSTED)
- OpenAI (HTTP 429 / rate_limit_exceeded / insufficient_quota)
- Anthropic (HTTP 429 / rate_limit_error)
- GitHub REST API (HTTP 403 / 429 / x-ratelimit-remaining == 0)

Provides:
- Distinguishes temporary rate limits (TPM/RPM) from exhausted daily quotas (TPD/RPD).
- Email alert cooldown tracking to prevent inbox flooding.
- Real-time provider health status for the frontend.
"""

import re
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List


class LimitType:
    NONE = "none"
    TEMPORARY_BURST = "temporary_rate_limit"      # TPM or RPM short-term limit
    DAILY_EXHAUSTED = "quota_exhausted"           # TPD or daily/monthly quota reached


class AlertCooldownManager:
    """
    Prevents inbox flooding by enforcing a minimum cooldown interval
    between automated email alerts for the same category.
    """
    _LAST_ALERT_TIMESTAMPS: Dict[str, float] = {}
    DEFAULT_COOLDOWN_SECONDS: int = 900  # 15 minutes cooldown

    @classmethod
    def can_send_alert(cls, alert_key: str, cooldown_seconds: Optional[int] = None) -> bool:
        """Checks whether an alert under this key is eligible to be dispatched."""
        cooldown = cooldown_seconds or cls.DEFAULT_COOLDOWN_SECONDS
        last_sent = cls._LAST_ALERT_TIMESTAMPS.get(alert_key, 0)
        return (time.time() - last_sent) >= cooldown

    @classmethod
    def record_alert_sent(cls, alert_key: str) -> None:
        """Records the timestamp of a dispatched email alert."""
        cls._LAST_ALERT_TIMESTAMPS[alert_key] = time.time()

    @classmethod
    def get_remaining_cooldown(cls, alert_key: str, cooldown_seconds: Optional[int] = None) -> int:
        """Returns the remaining seconds of cooldown before the next alert can be dispatched."""
        cooldown = cooldown_seconds or cls.DEFAULT_COOLDOWN_SECONDS
        last_sent = cls._LAST_ALERT_TIMESTAMPS.get(alert_key, 0)
        elapsed = time.time() - last_sent
        return max(0, int(cooldown - elapsed))

    @classmethod
    def reset_cooldown(cls, alert_key: Optional[str] = None) -> None:
        """Resets cooldown timer(s), e.g. after a key rotation."""
        if alert_key:
            cls._LAST_ALERT_TIMESTAMPS.pop(alert_key, None)
        else:
            cls._LAST_ALERT_TIMESTAMPS.clear()


# In-memory store for active rate limit flags
_ACTIVE_FLAGS: Dict[str, Dict[str, Any]] = {}


class RateLimitManager:
    @classmethod
    def classify_error(
        cls,
        provider: str,
        status_code: int,
        response_text: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Inspects provider error response to distinguish temporary RPM/TPM limits
        from true daily/monthly quota exhaustion.
        """
        headers = headers or {}
        text_lower = response_text.lower()
        provider = provider.lower().strip()

        limit_type = LimitType.TEMPORARY_BURST
        limit_scope = "rpm_tpm"
        retry_seconds = 30  # Default short backoff

        # 1. Inspect headers for explicit retry-after
        raw_retry = headers.get("retry-after") or headers.get("Retry-After")
        if raw_retry:
            try:
                retry_seconds = int(float(raw_retry))
            except (ValueError, TypeError):
                pass

        # 2. Check for Daily or Exhausted Quota indicators
        is_exhausted = any(phrase in text_lower for phrase in [
            "tokens per day",
            "requests per day",
            "daily limit",
            "daily_limit_exceeded",
            "tokens_per_day",
            "requests_per_day",
            "insufficient_quota",
            "quota_exceeded",
            "exceeded your current quota",
            "try again tomorrow",
            "monthly quota",
            "billing",
        ])

        # Also check for regex match of TPD in text
        if is_exhausted or "tpd" in text_lower or "rpd" in text_lower:
            limit_type = LimitType.DAILY_EXHAUSTED
            limit_scope = "tpd_daily"
            retry_seconds = 86400  # 24 hours / next day

        elif any(phrase in text_lower for phrase in ["tokens per minute", "requests per minute", "tpm", "rpm"]):
            limit_type = LimitType.TEMPORARY_BURST
            limit_scope = "tpm_rpm"
            # Try parsing seconds from e.g. "Please try again in 2.5s"
            sec_match = re.search(r"try again in (\d+(\.\d+)?)s", text_lower)
            if sec_match:
                try:
                    retry_seconds = max(5, int(float(sec_match.group(1)) + 1))
                except ValueError:
                    pass

        # 3. Formulate clear recommendation
        if limit_type == LimitType.DAILY_EXHAUSTED:
            recommendation = (
                f"{provider.title()} daily quota has been exhausted. "
                "The platform administrator has been notified. You can continue without waiting by "
                "entering your own API key in AI Engine (BYOK) settings."
            )
        else:
            recommendation = (
                f"{provider.title()} is experiencing a momentary traffic surge ({limit_scope.upper()} limit). "
                f"Cooldown in progress (approx. {retry_seconds}s). Requests will resume automatically, "
                "or you can provide a personal API key to bypass platform sharing."
            )

        return {
            "limit_type": limit_type,
            "limit_scope": limit_scope,
            "is_exhausted": limit_type == LimitType.DAILY_EXHAUSTED,
            "retry_after_seconds": retry_seconds,
            "recommendation": recommendation,
        }

    @classmethod
    def raise_flag(
        cls,
        provider: str,
        model: Optional[str] = None,
        status_code: int = 429,
        error_message: str = "Rate limit or quota threshold reached.",
        limit_type: str = LimitType.TEMPORARY_BURST,
        limit_scope: str = "tpm_rpm",
        retry_after_seconds: Optional[int] = None,
        recommendation: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Raises a rate limit flag with explicit classification (temporary vs exhausted).
        """
        now = time.time()
        retry_seconds = retry_after_seconds if (retry_after_seconds and retry_after_seconds > 0) else 60

        flag_data = {
            "id": f"flag_{provider}_{int(now)}",
            "provider": provider.lower(),
            "model": model,
            "status_code": status_code,
            "limit_type": limit_type,
            "limit_scope": limit_scope,
            "is_exhausted": limit_type == LimitType.DAILY_EXHAUSTED,
            "error_message": error_message,
            "retry_after_seconds": retry_seconds,
            "flagged_at": datetime.now(timezone.utc).isoformat(),
            "expires_at_timestamp": now + retry_seconds,
            "recommendation": recommendation or f"Rate limit reached for {provider.title()}.",
            "is_active": True,
        }

        _ACTIVE_FLAGS[provider.lower()] = flag_data
        print(f"[RATE_LIMIT_FLAG] Raised flag for {provider} (type: {limit_type}, scope: {limit_scope}, retry_after: {retry_seconds}s)")
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
    def is_exhausted(cls, provider: str) -> bool:
        """Returns True if provider has exhausted its full daily/monthly quota."""
        cls.cleanup_expired()
        flag = _ACTIVE_FLAGS.get(provider.lower())
        return bool(flag and flag.get("is_exhausted"))

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

    @classmethod
    def get_provider_status(cls, provider: str) -> Dict[str, Any]:
        """Provides comprehensive health status for UI badges and diagnostics."""
        cls.cleanup_expired()
        flag = _ACTIVE_FLAGS.get(provider.lower())

        if not flag:
            return {
                "provider": provider.lower(),
                "status": "healthy",
                "label": "Online & Healthy",
                "limit_type": LimitType.NONE,
                "is_rate_limited": False,
                "is_exhausted": False,
                "retry_after_seconds": 0,
                "message": f"{provider.title()} service is operational with optimal latency.",
            }

        now = time.time()
        remaining = max(1, int(flag.get("expires_at_timestamp", now) - now))

        if flag.get("is_exhausted"):
            return {
                "provider": provider.lower(),
                "status": "quota_exhausted",
                "label": "Daily Quota Exhausted",
                "limit_type": LimitType.DAILY_EXHAUSTED,
                "is_rate_limited": True,
                "is_exhausted": True,
                "retry_after_seconds": remaining,
                "message": flag.get("error_message", "Daily quota depleted on master key."),
                "recommendation": flag.get("recommendation"),
            }

        return {
            "provider": provider.lower(),
            "status": "temporarily_rate_limited",
            "label": f"Temporarily Rate-Limited ({remaining}s)",
            "limit_type": LimitType.TEMPORARY_BURST,
            "is_rate_limited": True,
            "is_exhausted": False,
            "retry_after_seconds": remaining,
            "message": flag.get("error_message", "Temporary rate limit in progress."),
            "recommendation": flag.get("recommendation"),
        }
