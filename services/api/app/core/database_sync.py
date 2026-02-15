"""Synchronous database session for Celery worker tasks."""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Celery workers need sync DB; read DATABASE_URL_SYNC or convert asyncpg URL.
_sync_url = os.environ.get("DATABASE_URL_SYNC", "")
if not _sync_url:
    _async_url = os.environ.get("DATABASE_URL", "")
    _sync_url = _async_url.replace("postgresql+asyncpg://", "postgresql://")

sync_engine = create_engine(_sync_url, echo=False, pool_pre_ping=True)
SyncSession = sessionmaker(sync_engine, class_=Session, expire_on_commit=False)


def get_sync_db() -> Session:
    """Yields a sync DB session (for Celery tasks)."""
    session = SyncSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
