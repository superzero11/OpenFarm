"""OpenFarm API — FastAPI application entry point."""

from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.rate_limit import limiter
from app.routers import (
    alerts,
    farms,
    fields,
    jobs,
    monitoring,
    orgs,
    scouting,
    share,
    uploads,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    setup_logging()
    yield


app = FastAPI(
    title="OpenFarm API",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Org-Id"],
    max_age=3600,
)

# ── Rate Limiting ────────────────────────────────────────────────────
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )


app.add_middleware(SlowAPIMiddleware)


# ── Routers ──────────────────────────────────────────────────────────
PREFIX = "/v1"

app.include_router(users.router, prefix=PREFIX, tags=["users"])
app.include_router(orgs.router, prefix=PREFIX, tags=["orgs"])
app.include_router(farms.router, prefix=PREFIX, tags=["farms"])
app.include_router(fields.router, prefix=PREFIX, tags=["fields"])
app.include_router(monitoring.router, prefix=PREFIX, tags=["monitoring"])
app.include_router(jobs.router, prefix=PREFIX, tags=["jobs"])
app.include_router(alerts.router, prefix=PREFIX, tags=["alerts"])
app.include_router(scouting.router, prefix=PREFIX, tags=["scouting"])
app.include_router(share.router, prefix=PREFIX, tags=["share"])
app.include_router(uploads.router, prefix=PREFIX, tags=["uploads"])


# ── Health Check ─────────────────────────────────────────────────────
@app.get("/healthz", tags=["health"])
async def healthz():
    """Check DB connection and Redis ping."""
    errors: list[str] = []

    # DB check
    try:
        from sqlalchemy import text
        from app.core.database import engine

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        errors.append(f"db: {e}")

    # Redis check
    try:
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
    except Exception as e:
        errors.append(f"redis: {e}")

    if errors:
        return {"status": "unhealthy", "errors": errors}
    return {"status": "ok"}
