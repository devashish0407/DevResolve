"""
Unified LLM & BYOK Service
Supports multi-provider LLM orchestration:
- Groq Cloud (Llama 3.3 70B, Llama 3.1 8B, Mixtral) — Fast & Free Tier!
- Google Gemini (Gemini 1.5 Flash / 2.0 Flash) via REST API
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude 3.5 Sonnet)
- Local Ollama (Llama 3.2, Mistral, DeepSeek)
"""

import httpx
import os
import time
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.core.rate_limit_manager import RateLimitManager

# In-memory store for runtime BYOK settings (can be overridden by user in UI without restarting server)
_BYOK_STORE: Dict[str, Any] = {
    "provider": "groq",
    "model": "qwen/qwen3.8-27b",
    "api_key": getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY") or "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",
    "custom_endpoint": "",
}

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
    "ollama": [
        {"id": "llama3.2", "name": "Llama 3.2 (Local)", "context": "8k tokens"},
        {"id": "deepseek-r1", "name": "DeepSeek R1 (Local Reasoning)", "context": "32k tokens"},
        {"id": "mistral", "name": "Mistral 7B (Local)", "context": "8k tokens"},
    ],
}


class LLMService:
    def __init__(self):
        pass

    @classmethod
    def get_byok_config(cls) -> Dict[str, Any]:
        """Get current BYOK config with masked key and active rate-limit flags."""
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

        return {
            "provider": provider,
            "model": _BYOK_STORE.get("model", "llama-3.3-70b-versatile"),
            "has_key": is_valid,
            "masked_key": masked,
            "supported_models": SUPPORTED_MODELS,
            "custom_endpoint": _BYOK_STORE.get("custom_endpoint", ""),
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
            "ollama": "llama3.2",
        }
        return fallbacks.get(provider, valid_ids[0] if valid_ids else "default")

    @classmethod
    def update_byok_config(cls, provider: str, model: str, api_key: Optional[str] = None, custom_endpoint: Optional[str] = None):
        """Update runtime BYOK configuration with sanitized model mapping."""
        provider = provider.lower().strip()
        _BYOK_STORE["provider"] = provider
        _BYOK_STORE["model"] = cls.sanitize_model(provider, model)
        if api_key is not None and api_key.strip():
            _BYOK_STORE["api_key"] = api_key.strip()
        if custom_endpoint is not None:
            _BYOK_STORE["custom_endpoint"] = custom_endpoint.strip()

    @classmethod
    def get_active_api_key(cls, provider: str) -> str:
        """Returns the active key for the chosen provider."""
        # Check in-memory store first
        if _BYOK_STORE.get("provider") == provider and _BYOK_STORE.get("api_key"):
            key = _BYOK_STORE["api_key"].strip()
            if key and not key.endswith("..."):
                return key

        # Check env vars
        if provider == "groq":
            key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY") or ""
        elif provider == "gemini":
            key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None) or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        elif provider == "openai":
            key = getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY") or ""
        elif provider == "anthropic":
            key = getattr(settings, "ANTHROPIC_API_KEY", None) or os.getenv("ANTHROPIC_API_KEY") or ""
        else:
            key = ""

        return key.strip() if key and not key.endswith("...") else ""

    async def test_connection(self, provider: str, api_key: str, model: str) -> Dict[str, Any]:
        """Pings the target LLM provider to verify key validity and measure latency."""
        t0 = time.time()
        provider = provider.lower().strip()
        api_key = (api_key or "").strip()
        model = self.sanitize_model(provider, model)

        # Pre-validate key prefixes to prevent confusing 400/404 errors
        if "..." in api_key:
            return {
                "status": "error",
                "message": "It looks like you copied the masked key from the Groq table (it contains '...'). In the Groq Console, the full secret key is only shown once in the popup when clicking '+ Create API Key'. Please click '+ Create API Key' on console.groq.com/keys, copy the full unmasked key from the popup, and paste it here."
            }

        if provider == "gemini" and api_key.startswith("gsk_"):
            return {
                "status": "error",
                "message": "This API key starts with 'gsk_', which is a Groq Cloud key. Please select 'Groq Cloud' as your provider, or get a Gemini API key from https://aistudio.google.com"
            }
        if provider == "groq" and api_key.startswith("AIza"):
            return {
                "status": "error",
                "message": "This API key starts with 'AIza', which is a Google Gemini key. Please select 'Google Gemini' as your provider, or get a free Groq key from https://console.groq.com/keys"
            }
        if provider == "groq" and api_key.startswith("sk-") and not api_key.startswith("gsk_"):
            return {
                "status": "error",
                "message": "This API key starts with 'sk-', which is an OpenAI key. Please select 'OpenAI' as your provider, or get a free Groq key from https://console.groq.com/keys"
            }

        try:
            # ── 1. Groq Cloud ─────────────────────────────────────
            if provider == "groq":
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
                # Check models endpoint first to confirm key validity and detect active models
                models_url = "https://api.groq.com/openai/v1/models"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    models_res = await client.get(models_url, headers=headers)
                    latency = round((time.time() - t0) * 1000)
                    if models_res.status_code == 200:
                        RateLimitManager.clear_flag("groq")
                        models_data = models_res.json().get("data", [])
                        active_ids = [m.get("id") for m in models_data if not m.get("id", "").startswith("whisper")]
                        chosen_model = model if model in active_ids else ("llama-3.3-70b-versatile" if "llama-3.3-70b-versatile" in active_ids else (active_ids[0] if active_ids else model))
                        return {
                            "status": "success",
                            "message": f"Successfully connected to Groq Cloud! Using {chosen_model}.",
                            "latency_ms": latency,
                            "active_models": active_ids[:6],
                        }
                    elif models_res.status_code == 401:
                        return {
                            "status": "error",
                            "message": "Invalid Groq API Key (HTTP 401 Unauthorized). Please make sure the full key was copied when creating it."
                        }
                    else:
                        err_text = models_res.text
                        try:
                            err_text = models_res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        return {"status": "error", "message": f"Groq error ({models_res.status_code}): {err_text[:200]}"}

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
                    elif res.status_code == 429 or "RESOURCE_EXHAUSTED" in res.text or "quota" in res.text.lower():
                        err_text = res.text
                        try:
                            err_text = res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        flag = RateLimitManager.raise_flag(
                            provider="gemini",
                            model=model,
                            status_code=res.status_code,
                            error_message=err_text,
                            retry_after_seconds=60,
                        )
                        return {
                            "status": "rate_limit",
                            "message": f"🚨 Rate Limit Flag Raised: Gemini API quota exceeded (HTTP 429).",
                            "rate_limit_flag": flag,
                            "latency_ms": latency,
                        }
                    else:
                        err_text = res.text
                        try:
                            err_text = res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        return {"status": "error", "message": f"Gemini error ({res.status_code}): {err_text}"}

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
                    elif res.status_code == 429 or "rate_limit" in res.text.lower() or "insufficient_quota" in res.text.lower():
                        err_text = res.text
                        try:
                            err_text = res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        flag = RateLimitManager.raise_flag(
                            provider="openai",
                            model=model,
                            status_code=res.status_code,
                            error_message=err_text,
                            retry_after_seconds=60,
                        )
                        return {
                            "status": "rate_limit",
                            "message": f"🚨 Rate Limit Flag Raised: OpenAI rate limit or quota exceeded (HTTP 429).",
                            "rate_limit_flag": flag,
                            "latency_ms": latency,
                        }
                    else:
                        return {"status": "error", "message": f"OpenAI error ({res.status_code}): {res.text[:200]}"}

            # ── 4. Ollama (Local) ─────────────────────────────────
            elif provider == "ollama":
                endpoint = _BYOK_STORE.get("custom_endpoint") or "http://localhost:11434"
                url = f"{endpoint}/api/tags"
                try:
                    async with httpx.AsyncClient(timeout=4.0) as client:
                        res = await client.get(url)
                        latency = round((time.time() - t0) * 1000)
                        if res.status_code == 200:
                            RateLimitManager.clear_flag("ollama")
                            models = [m.get("name") for m in res.json().get("models", [])]
                            models_str = ", ".join(models[:4]) if models else "No models installed yet"
                            return {
                                "status": "success",
                                "message": f"Connected to local Ollama! Models available: {models_str}",
                                "latency_ms": latency,
                            }
                        else:
                            return {"status": "error", "message": f"Ollama returned HTTP {res.status_code}"}
                except (httpx.ConnectError, httpx.ConnectTimeout):
                    return {
                        "status": "error",
                        "message": "The local AI engine is currently offline or unreachable. Please ensure the local service is running or switch to a cloud engine in settings."
                    }

            else:
                return {"status": "error", "message": f"Provider '{provider}' test not implemented"}
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}

    async def query_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        rag_context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Executes a prompt against the active BYOK LLM engine with optional RAG context injection
        and full multi-turn conversational memory.
        """
        provider = _BYOK_STORE.get("provider", "groq")
        model = self.sanitize_model(provider, _BYOK_STORE.get("model"))
        api_key = self.get_active_api_key(provider)

        # Context grounding
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

        # ── 1. Groq Cloud (Free Tier & Fast) ───────────────────────
        if provider == "groq":
            if not api_key:
                return {
                    "provider": "groq",
                    "model": model,
                    "has_key": False,
                    "error": "missing_key",
                    "content": None,
                }

            url = "https://api.groq.com/openai/v1/chat/completions"
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

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    if res.status_code == 200:
                        RateLimitManager.clear_flag("groq")
                        data = res.json()
                        text = data["choices"][0]["message"]["content"]
                        return {
                            "provider": "groq",
                            "model": model,
                            "has_key": True,
                            "content": text.strip(),
                        }
                    elif res.status_code == 429 or "rate_limit" in res.text.lower():
                        err_text = res.text
                        try:
                            err_text = res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        retry_after = 60
                        try:
                            retry_after = int(res.headers.get("retry-after", 60))
                        except Exception:
                            pass
                        flag = RateLimitManager.raise_flag(
                            provider="groq",
                            model=model,
                            status_code=res.status_code,
                            error_message=err_text,
                            retry_after_seconds=retry_after,
                        )
                        return {
                            "provider": "groq",
                            "model": model,
                            "has_key": True,
                            "error": "rate_limit_exceeded",
                            "rate_limit_flag": flag,
                            "content": None,
                        }
                    else:
                        print(f"Groq API error {res.status_code}: {res.text}")
                        # Auto-heal: If model was decommissioned or not found, automatically retry with flagship active model
                        if ("model_decommissioned" in res.text or "does not exist" in res.text or res.status_code in (400, 404)) and model != "llama-3.3-70b-versatile":
                            fallback_payload = {**payload, "model": "llama-3.3-70b-versatile"}
                            retry_res = await client.post(url, json=fallback_payload, headers=headers)
                            if retry_res.status_code == 200:
                                RateLimitManager.clear_flag("groq")
                                data = retry_res.json()
                                text = data["choices"][0]["message"]["content"]
                                return {
                                    "provider": "groq",
                                    "model": "llama-3.3-70b-versatile",
                                    "has_key": True,
                                    "content": text.strip(),
                                }
                        return {
                            "provider": "groq",
                            "model": model,
                            "has_key": True,
                            "error": f"Groq HTTP {res.status_code}: {res.text[:200]}",
                            "content": None,
                        }
            except Exception as e:
                print(f"Groq API request failed: {e}")
                return {"provider": "groq", "model": model, "has_key": True, "error": str(e), "content": None}

        # ── 2. Google Gemini ──────────────────────────────────────
        elif provider == "gemini":
            if not api_key:
                return {
                    "provider": "gemini",
                    "model": model,
                    "has_key": False,
                    "error": "missing_key",
                    "content": None,
                }

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": f"{system_prompt}\n\n{full_user_content}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 2048,
                }
            }

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        RateLimitManager.clear_flag("gemini")
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            text = "".join([p.get("text", "") for p in parts])
                            return {
                                "provider": "gemini",
                                "model": model,
                                "has_key": True,
                                "content": text.strip(),
                            }
                    elif res.status_code == 429 or "RESOURCE_EXHAUSTED" in res.text or "quota" in res.text.lower():
                        err_text = res.text
                        try:
                            err_text = res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        flag = RateLimitManager.raise_flag(
                            provider="gemini",
                            model=model,
                            status_code=res.status_code,
                            error_message=err_text,
                            retry_after_seconds=60,
                        )
                        return {
                            "provider": "gemini",
                            "model": model,
                            "has_key": True,
                            "error": "rate_limit_exceeded",
                            "rate_limit_flag": flag,
                            "content": None,
                        }
                    else:
                        print(f"Gemini API error {res.status_code}: {res.text}")
            except Exception as e:
                print(f"Gemini API request failed: {e}")

        # ── 3. OpenAI ─────────────────────────────────────────────
        elif provider == "openai":
            if not api_key:
                return {
                    "provider": "openai",
                    "model": model,
                    "has_key": False,
                    "error": "missing_key",
                    "content": None,
                }

            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}"}
            payload = {
                "model": model or "gpt-4o",
                "messages": formatted_messages,
                "temperature": 0.4,
                "max_tokens": 2048,
            }

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    if res.status_code == 200:
                        RateLimitManager.clear_flag("openai")
                        data = res.json()
                        text = data["choices"][0]["message"]["content"]
                        return {
                            "provider": "openai",
                            "model": model,
                            "has_key": True,
                            "content": text.strip(),
                        }
                    elif res.status_code == 429 or "rate_limit" in res.text.lower() or "insufficient_quota" in res.text.lower():
                        err_text = res.text
                        try:
                            err_text = res.json().get("error", {}).get("message", err_text)
                        except Exception:
                            pass
                        flag = RateLimitManager.raise_flag(
                            provider="openai",
                            model=model,
                            status_code=res.status_code,
                            error_message=err_text,
                            retry_after_seconds=60,
                        )
                        return {
                            "provider": "openai",
                            "model": model,
                            "has_key": True,
                            "error": "rate_limit_exceeded",
                            "rate_limit_flag": flag,
                            "content": None,
                        }
                    else:
                        print(f"OpenAI API error {res.status_code}: {res.text}")
            except Exception as e:
                print(f"OpenAI API request failed: {e}")

        # ── 4. Ollama (Local) ─────────────────────────────────────
        elif provider == "ollama":
            endpoint = _BYOK_STORE.get("custom_endpoint") or "http://localhost:11434"
            url = f"{endpoint}/api/chat"
            payload = {
                "model": model or "llama3.2",
                "messages": formatted_messages,
                "stream": False
            }
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        text = data.get("message", {}).get("content", "")
                        return {
                            "provider": "ollama",
                            "model": model,
                            "has_key": True,
                            "content": text.strip(),
                        }
                    else:
                        return {
                            "provider": "ollama",
                            "model": model,
                            "has_key": True,
                            "error": f"Ollama HTTP {res.status_code}",
                            "content": None,
                        }
            except (httpx.ConnectError, httpx.ConnectTimeout):
                return {
                    "provider": "ollama",
                    "model": model,
                    "has_key": False,
                    "error": "ollama_offline",
                    "content": None,
                }
            except Exception as e:
                print(f"Ollama request failed: {e}")

        # Fallback: No active key or unreachable provider
        return {
            "provider": provider,
            "model": model,
            "has_key": False,
            "error": "missing_key",
            "content": None,
        }
