"""
AI Settings & BYOK API Routes
Allows developers to configure their own LLM API keys (Gemini, OpenAI, Anthropic, Ollama),
test connection latency, and select reasoning models.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from app.core.security import get_current_user
from app.services.llm_service import LLMService

router = APIRouter()
llm_service = LLMService()


class BYOKConfigRequest(BaseModel):
    provider: str = Field(..., description="gemini | openai | anthropic | ollama")
    model: str = Field(..., description="Target model name")
    api_key: Optional[str] = Field(None, description="API Key for the provider")
    custom_endpoint: Optional[str] = Field(None, description="Custom endpoint for Ollama or proxy")


class BYOKTestRequest(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None


@router.get("/ai", summary="Get current AI & BYOK settings")
async def get_ai_settings(current_user: dict = Depends(get_current_user)):
    """Retrieve current AI provider, model, free tier quota progress, and masked key status."""
    user_id = current_user.get("auth_id", "guest")
    return LLMService.get_byok_config(user_id=user_id)


@router.post("/ai", summary="Save AI & BYOK settings")
async def save_ai_settings(
    payload: BYOKConfigRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update runtime AI provider, model, and API key."""
    user_id = current_user.get("auth_id", "guest")
    clean_api_key = LLMService.clean_key(payload.api_key)
    LLMService.update_byok_config(
        provider=payload.provider.lower().strip(),
        model=payload.model.strip(),
        api_key=clean_api_key,
    )
    return {
        "status": "success",
        "message": f"Updated AI reasoning engine to {payload.provider} ({payload.model})",
        "config": LLMService.get_byok_config(user_id=user_id),
    }


@router.post("/ai/test", summary="Test LLM provider connection")
async def test_ai_connection(
    payload: BYOKTestRequest,
    current_user: dict = Depends(get_current_user),
):
    """Test connection with the specified provider and API key."""
    key = LLMService.clean_key(payload.api_key)
    if not key or "•" in key or "..." in key:
        key = LLMService.get_active_api_key(payload.provider)

    if not key and payload.provider != "ollama":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please provide an API key to test {payload.provider.title()}.",
        )

    result = await llm_service.test_connection(
        provider=payload.provider.lower().strip(),
        api_key=key or "",
        model=payload.model.strip(),
    )
    return result


@router.get("/ai/rate-limits", summary="Get all active API rate limit flags")
async def get_active_rate_limits(current_user: dict = Depends(get_current_user)):
    """Returns real-time flags for services/providers that exceeded rate or quota limits."""
    from app.core.rate_limit_manager import RateLimitManager
    flags = RateLimitManager.get_active_flags()
    return {
        "status": "success",
        "has_rate_limit_raised": len(flags) > 0,
        "flags": flags,
    }


class ClearRateLimitRequest(BaseModel):
    provider: str


@router.post("/ai/rate-limits/clear", summary="Clear a rate limit flag")
async def clear_rate_limit(
    payload: ClearRateLimitRequest,
    current_user: dict = Depends(get_current_user),
):
    """Manually clear a raised rate limit flag for a provider."""
    from app.core.rate_limit_manager import RateLimitManager
    cleared = RateLimitManager.clear_flag(payload.provider)
    return {
        "status": "success",
        "cleared": cleared,
        "message": f"Cleared rate limit flag for {payload.provider}",
    }


@router.get("/ai/ollama-status", summary="Check local Ollama installation and hardware readiness")
async def get_ollama_status(
    endpoint: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns live connectivity, model availability, CLI existence,
    and system RAM checks for running local Ollama models.
    """
    return await LLMService.check_ollama_status(endpoint=endpoint)


class MasterKeyReplacementRequest(BaseModel):
    groq_api_key: str = Field(..., description="New master Groq API key (starts with gsk_)")


@router.post("/ai/master-key", summary="Hot-replace the platform master Groq key")
async def replace_master_key(
    payload: MasterKeyReplacementRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Allows replacing the platform master Groq key at runtime with live verification.
    No server restart or downtime required.
    """
    result = await LLMService.set_platform_master_key(payload.groq_api_key)
    if result.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Master key replacement failed"),
        )
    return result


@router.get("/ai/status", summary="Get detailed AI Engine and provider health")
async def get_ai_provider_status(current_user: dict = Depends(get_current_user)):
    """
    Returns real-time provider health, temporary rate-limit countdown,
    quota exhaustion indicators, and fallback readiness.
    """
    from app.core.rate_limit_manager import RateLimitManager
    user_id = current_user.get("auth_id", "guest")
    cfg = LLMService.get_byok_config(user_id=user_id)
    provider = cfg["provider"]
    status_info = RateLimitManager.get_provider_status(provider)

    return {
        "status": "success",
        "provider": provider,
        "health": status_info,
        "fallback_available": cfg.get("fallback_available", False),
        "fallback_provider": cfg.get("fallback_provider"),
        "free_tier": {
            "tokens_used": cfg.get("free_tier_tokens_used", 0),
            "limit": cfg.get("free_tier_limit", 5000),
            "is_free_tier": cfg.get("is_free_tier", True),
            "exceeded": cfg.get("free_tier_exceeded", False),
        },
    }


@router.post("/ai/switch-to-cloud", summary="1-Click fallback from local Ollama to Groq Cloud")
async def switch_to_cloud(
    current_user: dict = Depends(get_current_user),
):
    """
    Safely switches active reasoning engine to Groq Cloud (Free Tier),
    releasing all local RAM/GPU resources and disconnecting from local daemons.
    """
    LLMService.update_byok_config(
        provider="groq",
        model="qwen/qwen3.8-27b",
    )
    return {
        "status": "success",
        "message": "Switched reasoning engine to Groq Cloud (0 Local RAM/GPU, Free Tier)",
        "config": LLMService.get_byok_config(),
    }
