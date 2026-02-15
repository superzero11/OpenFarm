"""OpenFarm TiTiler — custom TiTiler with JWT authentication.

Per PRD: TiTiler endpoints require a valid JWT so that only authenticated
users can fetch NDVI tile imagery. The JWT is the same token minted by
the FastAPI API service (shared OPENFARM_JWT_SECRET).
"""

from __future__ import annotations

import os

from fastapi import Depends, FastAPI, HTTPException, Query, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.security.api_key import APIKeyQuery
from jose import JWTError, jwt
from titiler.core.factory import TilerFactory
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers

# ── Config ────────────────────────────────────────────────────────────

JWT_SECRET = os.environ.get("OPENFARM_JWT_SECRET", "change-me")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
CORS_ORIGINS = os.environ.get("TITILER_API_CORS_ORIGINS", "http://localhost:3000")

security = HTTPBearer(auto_error=False)
api_key_query = APIKeyQuery(name="access_token", auto_error=False)


# ── Authenticated path dependency ─────────────────────────────────────
# TiTiler's path_dependency must accept a `url` query param and return it.
# We combine URL extraction with JWT validation in a single dependency
# following the official TiTiler auth pattern.

def AuthenticatedDatasetPath(
    url: str = Query(..., description="Dataset URL"),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    access_token: str | None = Security(api_key_query),
) -> str:
    """Extract dataset URL and validate JWT from header or query param.

    Supports both:
    - Authorization: Bearer <token>  (standard)
    - ?access_token=<token>  (for MapLibre tile URLs that can't set headers)
    """
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif access_token:
        raw_token = access_token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    try:
        payload = jwt.decode(raw_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    return url


# ── App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="OpenFarm TiTiler",
    description="COG tile server with JWT authentication",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization"],
    max_age=3600,
)

# ── COG Tiler with JWT ───────────────────────────────────────────────

cog = TilerFactory(
    router_prefix="/cog",
    path_dependency=AuthenticatedDatasetPath,
)

app.include_router(cog.router, prefix="/cog", tags=["COG Tiles"])

# ── Exception handlers ───────────────────────────────────────────────
add_exception_handlers(app, DEFAULT_STATUS_CODES)


# ── Health Check (no auth) ───────────────────────────────────────────

@app.get("/healthz", tags=["health"])
async def healthz():
    return {"status": "ok"}
