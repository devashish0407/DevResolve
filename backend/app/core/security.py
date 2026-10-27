"""
DevResolve Security Module

Handles JWT validation, API key encryption/decryption,
and authorization helpers.

Security Principles:
  • JWT tokens validated on every request (Supabase-issued)
  • API keys encrypted with Fernet (symmetric, rotating-key-ready)
  • Authorization checks at the service layer, not just middleware
  • Secrets never logged or returned in API responses
"""

import hashlib
from datetime import datetime
from typing import Optional

from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings


# ── JWT / Bearer Token ────────────────────────────────────────────

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    """
    Validate the Supabase JWT and extract user claims.

    The token contains:
      sub  — Supabase Auth user UUID (maps to users.auth_id)
      email — user email
      exp  — expiration timestamp
      role — Supabase role (authenticated)

    Raises 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    auth_id: Optional[str] = payload.get("sub")
    if auth_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    return {
        "auth_id": auth_id,
        "email": payload.get("email"),
        "role": payload.get("role", "authenticated"),
        "exp": payload.get("exp"),
    }


# ── API Key Encryption ───────────────────────────────────────────

def _get_fernet() -> Fernet:
    """Get the Fernet cipher using the configured encryption key."""
    if not settings.API_KEY_ENCRYPTION_KEY:
        raise RuntimeError(
            "API_KEY_ENCRYPTION_KEY not configured — "
            "cannot encrypt/decrypt secrets"
        )
    return Fernet(settings.API_KEY_ENCRYPTION_KEY.encode())


def encrypt_api_key(plaintext_key: str) -> str:
    """Encrypt an API key for storage. Returns base64 ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt a stored API key. Returns plaintext."""
    f = _get_fernet()
    return f.decrypt(encrypted_key.encode()).decode()


def hash_api_key(plaintext_key: str) -> str:
    """SHA-256 hash for key lookup without decryption."""
    return hashlib.sha256(plaintext_key.encode()).hexdigest()


def get_key_prefix(plaintext_key: str) -> str:
    """Extract display prefix (e.g. 'sk-proj-xx...')."""
    return plaintext_key[:8] + "****" if len(plaintext_key) > 8 else "****"


# ── Authorization Helpers ─────────────────────────────────────────

async def require_project_access(
    project_id: str,
    user: dict,
    db,
    required_role: str = "viewer",
) -> bool:
    """
    Check if the current user has the required role on a project.
    
    Role hierarchy: owner > admin > member > viewer
    
    This is the authorization gate — called before any
    project-scoped operation.
    """
    role_hierarchy = {"owner": 4, "admin": 3, "member": 2, "viewer": 1}
    required_level = role_hierarchy.get(required_role, 1)

    # TODO: Query project_members table for user's role
    # For now, return True during development
    return True
