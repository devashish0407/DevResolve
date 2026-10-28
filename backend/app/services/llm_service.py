"""
Unified LLM & BYOK Service
Supports multi-provider LLM orchestration:
- Groq Cloud (Qwen 3.8 27B, Llama 3.3 70B, GPT-OSS 120B) — Fast & Free Tier!
- Google Gemini (Gemini 1.5 Flash / Pro, Gemini 2.0 Flash) via REST API
- OpenAI (GPT-4o, GPT-4o-mini, o1-mini)
- Anthropic (Claude 3.5 Sonnet, Claude 3.5 Haiku)

Provides:
- 5,000 token complimentary free tier per user account.
- Dynamic error classification: distinguishes temporary RPM/TPM bursts from daily TPD quota exhaustion.
- Automated fallback to secondary provider when available.
- Alert cooldown tracking so admins are alerted once per incident without inbox flooding.
- Hot-replacement of platform master key at runtime without restarts.
"""

import httpx
import os
import time
import asyncio
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.core.rate_limit_manager import (
    RateLimitManager,
    AlertCooldownManager,
    LimitType,
)

# In-memory store for runtime BYOK settings (can be overridden by user in UI without restarting server)
_PLATFORM_DEFAULT_GROQ_KEY = (
    getattr(settings, "GROQ_API_KEY", None)
    or os.getenv("GROQ_API_KEY")
    or "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"
)

_BYOK_STORE: Dict[str, Any] = {
    "provider": "groq",
    "model": "qwen/qwen3.8-27b",
    "api_key": _PLATFORM_DEFAULT_GROQ_KEY,
    "custom_api_key": None,  # Set only when user enters their own personal BYOK key
}

# ── Platform Free Tier & Usage Tracking ─────────────────────────────
USER_FREE_TIER_TOKEN_LIMIT = 5000  # 5,000 tokens maximum per user account
PLATFORM_GROQ_ALERT_THRESHOLD = 95000  # Alerts admin when ~5k tokens remain of daily quota

_USER_TOKENS: Dict[str, int] = {}
_PLATFORM_MASTER_TOKENS: int = 0
_QUOTA_ALERT_SENT: bool = False

# Supported models per provider
SUPPORTED_MODELS = {
    "groq": [
        {"id": "qwen/qwen3.8-27b", "name": "Qwen 3.8 27B (Active & Recommended)", "context": "128k tokens"},
        {"id": "openai/gpt-oss-120b", "name": "GPT-OSS 120B (High Reasoning)", "context": "128k tokens"},
        {"id": "openai/gpt-oss-20b", "name": "GPT-OSS 20B (Ultra-Fast)", "context": "64k tokens"},
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile", "context": "128k tokens"},
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "context": "128k tokens"},
    ],
    "gemini": [
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Fast & Low Latency)", "context": "1M tokens"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Deep Code Reasoning)", "context": "2M tokens"},
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Next-Gen)", "context": "1M tokens"},
    ],
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o (Omni Reasoning)", "context": "128k tokens"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Fast & Efficient)", "context": "128k tokens"},
        {"id": "o1-mini", "name": "o1-mini (STEM & Code Optimization)", "context": "128k tokens"},
    ],
    "anthropic": [
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (State-of-the-Art Code)", "context": "200k tokens"},
        {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku (Fast)", "context": "200k tokens"},
    ],
}


class LLMService:
    def __init__(self):
        pass

    @classmethod
    def get_byok_config(cls, user_id: str = "guest") -> Dict[str, Any]:
        """Get current BYOK config with masked key, free tier token progress, provider status, and fallback options."""
        provider = _BYOK_STORE.get("provider", "groq")
        raw_key = cls.get_active_api_key(provider)

        is_valid = bool(raw_key and not raw_key.endswith("...") and len(raw_key) > 8)

        # Mask key for frontend security
        if raw_key and len(raw_key) > 8:
            masked = raw_key[:4] + "•" * 8 + raw_key[-4:]
        elif raw_key:
            masked = "••••••••"
        else:
            masked = ""

        has_custom_byok = bool(_BYOK_STORE.get("custom_api_key"))
        user_used = _USER_TOKENS.get(user_id, 0)

        fallback_prov = cls.get_fallback_provider(exclude_provider=provider)
        status_info = RateLimitManager.get_provider_status(provider)

        return {
            "provider": provider,
            "model": _BYOK_STORE.get("model", "qwen/qwen3.8-27b"),
            "has_key": is_valid,
            "masked_key": masked,
            "supported_models": SUPPORTED_MODELS,
            "is_free_tier": not has_custom_byok,
            "free_tier_tokens_used": user_used,
            "free_tier_limit": USER_FREE_TIER_TOKEN_LIMIT,
            "free_tier_exceeded": (not has_custom_byok) and (user_used >= USER_FREE_TIER_TOKEN_LIMIT),
            "platform_tokens_total": _PLATFORM_MASTER_TOKENS,
            "provider_status": status_info,
            "fallback_available": bool(fallback_prov),
            "fallback_provider": fallback_prov,
            "active_rate_limit_flags": RateLimitManager.get_active_flags(),
            "is_current_provider_flagged": RateLimitManager.is_flagged(provider),
        }

    @classmethod
    def sanitize_model(cls, provider: str, model: Optional[str]) -> str:
        """Ensures the requested model belongs to the target provider, falling back to safe defaults."""
        provider = provider.lower().strip()
        models = SUPPORTED_MODELS.get(provider, [])
        valid_ids = [m["id"] for m in models]
        if model and model in valid_ids:
            return model
        fallbacks = {
            "groq": "qwen/qwen3.8-27b",
            "gemini": "gemini-1.5-flash",
            "openai": "gpt-4o-mini",
            "anthropic": "claude-3-5-haiku-20241022",
        }
        return fallbacks.get(provider, valid_ids[0] if valid_ids else "qwen/qwen3.8-27b")

    @classmethod
    def clean_key(cls, raw_key: Optional[str]) -> str:
        """Sanitizes raw API keys: removes quotes, whitespace, and 'Bearer ' prefixes."""
        if not raw_key:
            return ""
        key = str(raw_key).strip()
        # Remove surrounding double or single quotes
        if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
            key = key[1:-1].strip()
        # Remove Bearer prefix if present
        if key.lower().startswith("bearer "):
            key = key[7:].strip()
        return key

    @classmethod
    def update_byok_config(cls, provider: str, model: str, api_key: Optional[str] = None):
        """Update runtime BYOK configuration with sanitized model mapping."""
        provider = provider.lower().strip()
        _BYOK_STORE["provider"] = provider
        _BYOK_STORE["model"] = cls.sanitize_model(provider, model)
        cleaned = cls.clean_key(api_key)
        if cleaned and "•" not in cleaned and "..." not in cleaned:
            _BYOK_STORE["api_key"] = cleaned
            _BYOK_STORE["custom_api_key"] = cleaned
        else:
            # Empty or masked key -> Reset to platform default master key
            _BYOK_STORE["custom_api_key"] = None
            _BYOK_STORE["api_key"] = _PLATFORM_DEFAULT_GROQ_KEY

    @classmethod
    def get_fallback_provider(cls, exclude_provider: str) -> Optional[str]:
        """
        Finds the best available authorized fallback provider when the primary provider
        is rate-limited or exhausted. Checks environment variables and custom keys.
        """
        candidates = ["gemini", "openai", "anthropic", "groq"]
        for prov in candidates:
            if prov == exclude_provider.lower():
                continue
            if RateLimitManager.is_flagged(prov):
                continue
            key = cls.get_active_api_key(prov)
            if key and len(key) > 8 and not key.endswith("...") and "•" not in key:
                return prov
        return None

    @classmethod
    async def set_platform_master_key(cls, new_key: str) -> Dict[str, Any]:
        """
        Hot-replaces the platform master Groq key dynamically at runtime.
        Verifies the new key against Groq Cloud before committing.
        Resets token counters and clears any active rate-limit flags.
        """
        new_key = cls.clean_key(new_key)
        if not new_key or len(new_key) < 20 or not new_key.startswith("gsk_"):
            return {
                "status": "error",
                "message": "Invalid Groq API key format. Groq Cloud keys start with 'gsk_' and are 56+ characters.",
            }

        headers = {
            "Authorization": f"Bearer {new_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get("https://api.groq.com/openai/v1/models", headers=headers)
                if res.status_code != 200:
                    return {
                        "status": "error",
                        "message": f"Groq Cloud rejected this key (HTTP {res.status_code}): {res.text[:120]}",
                    }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Could not reach Groq Cloud to verify replacement key: {str(e)}",
            }

        global _PLATFORM_DEFAULT_GROQ_KEY, _PLATFORM_MASTER_TOKENS, _QUOTA_ALERT_SENT
        _PLATFORM_DEFAULT_GROQ_KEY = new_key
        if not _BYOK_STORE.get("custom_api_key"):
            _BYOK_STORE["api_key"] = new_key

        _PLATFORM_MASTER_TOKENS = 0
        _QUOTA_ALERT_SENT = False

        # Clear rate-limit flags and cooldowns
        RateLimitManager.clear_flag("groq")
        AlertCooldownManager.reset_cooldown("groq_daily_exhausted")
        AlertCooldownManager.reset_cooldown("groq_threshold_warning")

        masked = f"{new_key[:4]}••••••••{new_key[-4:]}"
        print(f"[HOT RELOAD] Master Groq key successfully updated to {masked}")
        return {
            "status": "success",
            "message": "Platform master Groq API key verified and updated successfully! All rate-limits cleared.",
            "masked_key": masked,
        }

    @classmethod
    def get_active_api_key(cls, provider: str) -> str:
        """Returns the active key for the chosen provider."""
        # 1. Check custom BYOK key if present and valid
        custom_key = cls.clean_key(_BYOK_STORE.get("custom_api_key"))
        if _BYOK_STORE.get("provider") == provider and custom_key and "•" not in custom_key and "..." not in custom_key:
            return custom_key

        # 2. Check in-memory store key
        stored_key = cls.clean_key(_BYOK_STORE.get("api_key"))
        if _BYOK_STORE.get("provider") == provider and stored_key and "•" not in stored_key and "..." not in stored_key:
            return stored_key

        # 3. Check env vars
        if provider == "groq":
            key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY") or _PLATFORM_DEFAULT_GROQ_KEY
        elif provider == "gemini":
            key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None) or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        elif provider == "openai":
            key = getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY") or ""
        elif provider == "anthropic":
            key = getattr(settings, "ANTHROPIC_API_KEY", None) or os.getenv("ANTHROPIC_API_KEY") or ""
        else:
            key = ""

        cleaned = cls.clean_key(key)
        if cleaned and "•" not in cleaned and "..." not in cleaned:
            return cleaned
        if provider == "groq":
            return _PLATFORM_DEFAULT_GROQ_KEY
        return ""

    async def test_connection(self, provider: str, api_key: str, model: str) -> Dict[str, Any]:
        """Pings the target LLM provider to verify key validity and measure latency."""
        t0 = time.time()
        provider = provider.lower().strip()
        api_key = self.clean_key(api_key)
        model = self.sanitize_model(provider, model)

        # Pre-validate key prefixes to prevent confusing errors
        if "..." in api_key or "•" in api_key:
            # If masked key was passed, resolve the actual unmasked active key
            api_key = self.get_active_api_key(provider)

        if not api_key and provider == "groq":
            api_key = self.get_active_api_key("groq")

        if not api_key:
            return {
                "status": "error",
                "message": f"Please provide an API key to test {provider.title()}."
            }

        if provider == "gemini" and api_key.startswith("gsk_"):
            return {
                "status": "error",
                "message": "This key starts with 'gsk_', which is a Groq key. Please select 'Groq Cloud' as your provider."
            }
        if provider == "groq" and api_key.startswith("AIza"):
            return {
                "status": "error",
                "message": "This key starts with 'AIza', which is a Google Gemini key. Please select 'Google Gemini' as your provider."
            }
        if provider == "groq" and api_key.startswith("sk-") and not api_key.startswith("gsk_"):
            return {
                "status": "error",
                "message": "This key starts with 'sk-', which is an OpenAI key. Please select 'OpenAI' as your provider."
            }

        try:
            # ── 1. Groq Cloud ─────────────────────────────────────
            if provider == "groq":
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
                models_url = "https://api.groq.com/openai/v1/models"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    models_res = await client.get(models_url, headers=headers)
                    latency = round((time.time() - t0) * 1000)
                    if models_res.status_code == 200:
                        RateLimitManager.clear_flag("groq")
                        models_data = models_res.json().get("data", [])
                        active_ids = [m.get("id") for m in models_data if not m.get("id", "").startswith("whisper")]
                        chosen_model = model if model in active_ids else (active_ids[0] if active_ids else model)
                        return {
                            "status": "success",
                            "message": f"Successfully connected to Groq Cloud! Model: {chosen_model}.",
                            "latency_ms": latency,
                            "active_models": active_ids[:6],
                        }
                    elif models_res.status_code == 401:
                        err_detail = "Invalid Groq API Key (HTTP 401 Unauthorized)."
                        try:
                            groq_err = models_res.json().get("error", {})
                            if groq_err.get("message"):
                                err_detail = f"Groq Cloud rejected key: {groq_err['message']}"
                        except Exception:
                            pass
                        return {
                            "status": "error",
                            "message": err_detail,
                        }
                    elif models_res.status_code == 429:
                        analysis = RateLimitManager.classify_error("groq", 429, models_res.text, dict(models_res.headers))
                        flag = RateLimitManager.raise_flag("groq", model, 429, models_res.text, **analysis)
                        return {
                            "status": "rate_limit",
                            "message": analysis["recommendation"],
                            "rate_limit_flag": flag,
                            "latency_ms": latency,
                        }
                    else:
                        return {"status": "error", "message": f"Groq error ({models_res.status_code}): {models_res.text[:200]}"}

            # ── 2. Google Gemini ──────────────────────────────────
            elif provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": "Reply with 'DevResolve Connected!'"}]}],
                    "generationConfig": {"maxOutputTokens": 20}
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(url, json=payload)
                    latency = round((time.time() - t0) * 1000)
                    if res.status_code == 200:
                        RateLimitManager.clear_flag("gemini")
                        return {
                            "status": "success",
                            "message": f"Successfully authenticated with Google Gemini ({model})!",
                            "latency_ms": latency,
                        }
                    elif res.status_code == 429 or "RESOURCE_EXHAUSTED" in res.text:
                        analysis = RateLimitManager.classify_error("gemini", 429, res.text, dict(res.headers))
                        flag = RateLimitManager.raise_flag("gemini", model, 429, res.text, **analysis)
                        return {
                            "status": "rate_limit",
                            "message": analysis["recommendation"],
                            "rate_limit_flag": flag,
                            "latency_ms": latency,
                        }
                    else:
                        return {"status": "error", "message": f"Gemini error ({res.status_code}): {res.text[:200]}"}

            # ── 3. OpenAI ─────────────────────────────────────────
            elif provider == "openai":
                url = "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {api_key}"}
                payload = {
                    "model": model or "gpt-4o-mini",
                    "messages": [{"role": "user", "content": "Reply with 'DevResolve Connected!'"}],
                    "max_tokens": 10
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    latency = round((time.time() - t0) * 1000)
                    if res.status_code == 200:
                        RateLimitManager.clear_flag("openai")
                        return {
                            "status": "success",
                            "message": f"Successfully authenticated with OpenAI ({model})!",
                            "latency_ms": latency,
                        }
                    else:
                        return {"status": "error", "message": f"OpenAI error ({res.status_code}): {res.text[:200]}"}

            # ── 4. Anthropic ──────────────────────────────────────
            elif provider == "anthropic":
                url = "https://api.anthropic.com/v1/messages"
                headers = {
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                }
                payload = {
                    "model": model or "claude-3-5-haiku-20241022",
                    "max_tokens": 15,
                    "messages": [{"role": "user", "content": "Hi"}],
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    latency = round((time.time() - t0) * 1000)
                    if res.status_code == 200:
                        RateLimitManager.clear_flag("anthropic")
                        return {
                            "status": "success",
                            "message": f"Successfully authenticated with Anthropic ({model})!",
                            "latency_ms": latency,
                        }
                    else:
                        return {"status": "error", "message": f"Anthropic error ({res.status_code}): {res.text[:200]}"}

            else:
                return {"status": "error", "message": f"Provider '{provider}' test not implemented"}
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}

    async def _execute_provider_call(
        self,
        provider: str,
        model: str,
        api_key: str,
        system_prompt: str,
        full_user_content: str,
        formatted_messages: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Low-level API dispatcher for a given provider."""
        api_key = self.clean_key(api_key)
        if not api_key or "•" in api_key or "..." in api_key:
            api_key = self.get_active_api_key(provider)

        # 1. Groq Cloud
        if provider == "groq":
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model or "qwen/qwen3.8-27b",
                "messages": formatted_messages,
                "temperature": 0.3,
                "max_tokens": 2048,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                return {
                    "status_code": res.status_code,
                    "headers": dict(res.headers),
                    "body": res.json() if res.status_code == 200 else {},
                    "raw_text": res.text,
                }

        # 2. Google Gemini
        elif provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"{system_prompt}\n\n{full_user_content}"}]
                    }
                ],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048}
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                data = res.json() if res.status_code == 200 else {}
                text = ""
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    text = "".join([p.get("text", "") for p in parts])
                return {
                    "status_code": res.status_code,
                    "headers": dict(res.headers),
                    "body": {"content": text},
                    "raw_text": res.text,
                }

        # 3. OpenAI
        elif provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": model or "gpt-4o-mini",
                "messages": formatted_messages,
                "temperature": 0.4,
                "max_tokens": 2048,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                data = res.json() if res.status_code == 200 else {}
                text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return {
                    "status_code": res.status_code,
                    "headers": dict(res.headers),
                    "body": {"content": text},
                    "raw_text": res.text,
                }

        # 4. Anthropic
        elif provider == "anthropic":
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            anthropic_messages = [m for m in formatted_messages if m["role"] != "system"]
            payload = {
                "model": model or "claude-3-5-sonnet-20241022",
                "system": system_prompt,
                "messages": anthropic_messages,
                "max_tokens": 2048,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                data = res.json() if res.status_code == 200 else {}
                text = "".join([c.get("text", "") for c in data.get("content", [])])
                return {
                    "status_code": res.status_code,
                    "headers": dict(res.headers),
                    "body": {"content": text},
                    "raw_text": res.text,
                }

        return {"status_code": 400, "headers": {}, "body": {}, "raw_text": f"Unsupported provider {provider}"}

    async def query_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        rag_context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        user_id: Optional[str] = "guest",
    ) -> Dict[str, Any]:
        """
        Executes a prompt against the active BYOK LLM engine with:
        - 5,000-token account quota enforcement.
        - Detailed HTTP 429 limit detection (temporary RPM/TPM vs daily TPD exhaustion).
        - Cooldown-protected email alerts to devashish0716@gmail.com.
        - Automatic graceful fallback to secondary providers (e.g. Gemini).
        - No endless retry loops.
        """
        uid = user_id or "guest"
        provider = _BYOK_STORE.get("provider", "groq")
        model = self.sanitize_model(provider, _BYOK_STORE.get("model"))
        api_key = self.get_active_api_key(provider)
        has_custom_byok = bool(_BYOK_STORE.get("custom_api_key"))

        # ── 1. Enforce 5k Platform Free Tier Token Limit ────────────
        if not has_custom_byok:
            user_used = _USER_TOKENS.get(uid, 0)
            if user_used >= USER_FREE_TIER_TOKEN_LIMIT:
                return {
                    "provider": "free_tier",
                    "model": model,
                    "has_key": False,
                    "error": "free_quota_exceeded",
                    "content": None,
                    "tokens_used": user_used,
                    "limit": USER_FREE_TIER_TOKEN_LIMIT,
                    "message": "You have consumed your 5,000 free tokens. Please enter your personal BYOK key in AI Settings.",
                }

        # Build context block
        context_block = ""
        if rag_context and rag_context.strip():
            context_block = (
                "\n\n--- RELEVANT CODEBASE & DOCUMENTATION CONTEXT (GROUND TRUTH) ---\n"
                f"{rag_context.strip()}\n"
                "--------------------------------------------------------------------\n"
            )
        full_user_content = f"{context_block}\n{user_prompt}".strip()

        # Build multi-turn messages array
        formatted_messages = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            for turn in conversation_history[-8:]:
                r = turn.get("role")
                c = turn.get("content")
                if c and r in ("user", "assistant"):
                    formatted_messages.append({"role": r, "content": c})
        formatted_messages.append({"role": "user", "content": full_user_content})

        # ── 2. Check if active provider is currently flagged as Exhausted ───
        if RateLimitManager.is_exhausted(provider):
            fallback_provider = self.get_fallback_provider(exclude_provider=provider)
            if fallback_provider:
                print(f"[PRE-EMPTIVE FALLBACK] {provider} daily quota is exhausted. Rerouting to {fallback_provider}!")
                fallback_key = self.get_active_api_key(fallback_provider)
                fallback_model = self.sanitize_model(fallback_provider, None)
                fb_res = await self._execute_provider_call(
                    fallback_provider, fallback_model, fallback_key, system_prompt, full_user_content, formatted_messages
                )
                if fb_res["status_code"] == 200:
                    text = fb_res["body"].get("content") or fb_res["body"].get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {
                        "provider": fallback_provider,
                        "model": fallback_model,
                        "has_key": True,
                        "content": text.strip(),
                        "fallback_used": True,
                        "fallback_provider": fallback_provider,
                        "original_provider": provider,
                    }
            else:
                status_info = RateLimitManager.get_provider_status(provider)
                return {
                    "provider": provider,
                    "model": model,
                    "has_key": bool(api_key),
                    "error": "quota_exhausted",
                    "content": None,
                    "message": status_info.get("recommendation", "Daily quota reached. Admin alerted."),
                }

        # ── 3. Execute Primary Request ─────────────────────────────
        try:
            call_res = await self._execute_provider_call(
                provider, model, api_key, system_prompt, full_user_content, formatted_messages
            )
        except Exception as e:
            return {"provider": provider, "model": model, "has_key": bool(api_key), "error": str(e), "content": None}

        # ── 4. Handle Successful Execution ─────────────────────────
        if call_res["status_code"] == 200:
            RateLimitManager.clear_flag(provider)
            if provider == "groq":
                text = call_res["body"]["choices"][0]["message"]["content"]
                tokens_consumed = call_res["body"].get("usage", {}).get("total_tokens", len(full_user_content) // 4 + len(text) // 4)
            else:
                text = call_res["body"].get("content", "")
                tokens_consumed = len(full_user_content) // 4 + len(text) // 4

            if not has_custom_byok:
                _USER_TOKENS[uid] = _USER_TOKENS.get(uid, 0) + tokens_consumed
                global _PLATFORM_MASTER_TOKENS, _QUOTA_ALERT_SENT
                _PLATFORM_MASTER_TOKENS += tokens_consumed

                # Check master key alert threshold (guarded by AlertCooldownManager)
                if _PLATFORM_MASTER_TOKENS >= PLATFORM_GROQ_ALERT_THRESHOLD:
                    if AlertCooldownManager.can_send_alert("groq_threshold_warning", cooldown_seconds=900):
                        AlertCooldownManager.record_alert_sent("groq_threshold_warning")
                        try:
                            from app.services.email_service import EmailService
                            asyncio.create_task(
                                EmailService().send_quota_warning_email(
                                    tokens_used=_PLATFORM_MASTER_TOKENS,
                                    limit=100000,
                                    reason="Platform Master Groq Key has < 5k tokens remaining (~1k headroom)",
                                    alert_type="groq_threshold_warning",
                                )
                            )
                        except Exception as e:
                            print(f"[Email Alert] Warning failed: {e}")

            return {
                "provider": provider,
                "model": model,
                "has_key": True,
                "content": text.strip(),
                "tokens_used": tokens_consumed,
            }

        # ── 5. Handle Rate Limits (HTTP 429) & Quota Limits ─────────
        if call_res["status_code"] == 429 or "rate_limit" in call_res["raw_text"].lower() or "quota" in call_res["raw_text"].lower():
            err_text = call_res["raw_text"]
            try:
                import json
                err_text = json.loads(call_res["raw_text"]).get("error", {}).get("message", err_text)
            except Exception:
                pass

            analysis = RateLimitManager.classify_error(
                provider=provider,
                status_code=call_res["status_code"],
                response_text=err_text,
                headers=call_res["headers"],
            )

            flag = RateLimitManager.raise_flag(
                provider=provider,
                model=model,
                status_code=call_res["status_code"],
                error_message=err_text,
                limit_type=analysis["limit_type"],
                limit_scope=analysis["limit_scope"],
                retry_after_seconds=analysis["retry_after_seconds"],
                recommendation=analysis["recommendation"],
            )

            # Email Alert: Only send on true daily quota exhaustion, guarded by 15-minute cooldown
            if analysis["is_exhausted"]:
                alert_key = f"{provider}_daily_exhausted"
                if AlertCooldownManager.can_send_alert(alert_key, cooldown_seconds=900):
                    AlertCooldownManager.record_alert_sent(alert_key)
                    try:
                        from app.services.email_service import EmailService
                        asyncio.create_task(
                            EmailService().send_quota_warning_email(
                                tokens_used=_PLATFORM_MASTER_TOKENS,
                                limit=100000,
                                reason=f"{provider.title()} Daily Quota Depleted: {err_text[:180]}",
                                alert_type=alert_key,
                            )
                        )
                    except Exception as e:
                        print(f"[Email Alert] Quota exhaustion email failed: {e}")

            # Graceful Fallback: Seamlessly failover to secondary provider if available
            fallback_provider = self.get_fallback_provider(exclude_provider=provider)
            if fallback_provider:
                print(f"[GRACEFUL FALLBACK] {provider} encountered {analysis['limit_type']}. Rerouting to {fallback_provider}...")
                fallback_key = self.get_active_api_key(fallback_provider)
                fallback_model = self.sanitize_model(fallback_provider, None)
                fb_res = await self._execute_provider_call(
                    fallback_provider, fallback_model, fallback_key, system_prompt, full_user_content, formatted_messages
                )
                if fb_res["status_code"] == 200:
                    text = fb_res["body"].get("content") or fb_res["body"].get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {
                        "provider": fallback_provider,
                        "model": fallback_model,
                        "has_key": True,
                        "content": text.strip(),
                        "fallback_used": True,
                        "fallback_provider": fallback_provider,
                        "original_provider": provider,
                        "notice": f"DevResolve seamlessly rerouted this inquiry to {fallback_provider.title()} while {provider.title()} cools down.",
                    }

            # No fallback provider configured -> Return clear, structured status
            return {
                "provider": provider,
                "model": model,
                "has_key": True,
                "error": "quota_exhausted" if analysis["is_exhausted"] else "temporary_rate_limit",
                "rate_limit_flag": flag,
                "is_exhausted": analysis["is_exhausted"],
                "retry_after_seconds": analysis["retry_after_seconds"],
                "message": analysis["recommendation"],
                "content": None,
            }

        # Other API Errors (e.g. 400, 401, 500)
        return {
            "provider": provider,
            "model": model,
            "has_key": True,
            "error": f"API HTTP {call_res['status_code']}: {call_res['raw_text'][:200]}",
            "content": None,
        }
