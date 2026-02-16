"""Share links router — create, list, revoke, public read, tile proxy."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import (
    Alert,
    AuditEvent,
    Field,
    FieldStat,
    RasterLayer,
    ScoutingObservation,
    ShareLink,
)
from app.schemas.monitoring import ScoutingOut, ShareCreate, ShareOut, ShareReportOut

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")

# ── Tile proxy helpers ────────────────────────────────────────────────

_http_client: httpx.AsyncClient | None = None


def _make_empty_tile() -> bytes:
    """Generate a valid 256×256 transparent PNG at import time."""
    import struct
    import zlib

    width, height = 256, 256

    def _chunk(ctype: bytes, data: bytes) -> bytes:
        c = ctype + data
        crc = struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack(">I", len(data)) + c + crc

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = _chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    scanline = b"\x00" + b"\x00\x00\x00\x00" * width
    raw = scanline * height
    idat = _chunk(b"IDAT", zlib.compress(raw))
    iend = _chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


_EMPTY_TILE = _make_empty_tile()


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


def _mint_service_jwt() -> str:
    """Mint a short-lived JWT for internal TiTiler calls."""
    payload = {
        "sub": "service:share-proxy",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(
        payload, settings.openfarm_jwt_secret, algorithm=settings.jwt_algorithm
    )


@router.get("/fields/{field_id}/share", response_model=list[ShareOut])
async def list_share_links(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShareLink).where(
            ShareLink.field_id == field_id,
            ShareLink.org_id == ctx.org_id,
            ShareLink.revoked_at.is_(None),
        )
    )
    # Filter out expired links
    now = datetime.now(timezone.utc)
    return [
        link
        for link in result.scalars().all()
        if link.expires_at is None or link.expires_at > now
    ]


@router.post(
    "/fields/{field_id}/share",
    response_model=ShareOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_share_link(
    field_id: uuid.UUID,
    body: ShareCreate,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    expires_at = None
    if body.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)

    link = ShareLink(
        org_id=ctx.org_id,
        field_id=field_id,
        token=secrets.token_urlsafe(32),
        scope=body.scope,
        expires_at=expires_at,
        created_by=ctx.user.id,
    )
    db.add(link)

    # Audit event: report_shared (per PRD Section 5.1)
    db.add(
        AuditEvent(
            org_id=ctx.org_id,
            user_id=ctx.user.id,
            event_type="report_shared",
            metadata_json={
                "field_id": str(field_id),
                "scope": body.scope,
                "token": link.token,
            },
        )
    )
    await db.flush()
    logger.info("report_shared", field_id=str(field_id), scope=body.scope)
    return link


@router.delete(
    "/fields/{field_id}/share/{token}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_share_link(
    field_id: uuid.UUID,
    token: str,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShareLink).where(
            ShareLink.field_id == field_id,
            ShareLink.org_id == ctx.org_id,
            ShareLink.token == token,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    link.revoked_at = datetime.now(timezone.utc)
    link.revoked_by = ctx.user.id
    await db.flush()


@router.get("/share/{token}", response_model=ShareReportOut)
async def get_shared_report(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Public endpoint — no auth required."""
    result = await db.execute(select(ShareLink).where(ShareLink.token == token))
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    now = datetime.now(timezone.utc)
    if link.revoked_at is not None:
        raise HTTPException(status_code=410, detail="Share link has been revoked")
    if link.expires_at is not None and link.expires_at < now:
        raise HTTPException(status_code=410, detail="Share link has expired")

    # Load field
    field = await db.get(Field, link.field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    from geoalchemy2.shape import to_shape
    from shapely.geometry import mapping

    field_data = {
        "id": str(field.id),
        "name": field.name,
        "area_ha": float(field.area_ha) if field.area_ha else None,
        "crop_type": field.crop_type,
        "geom": mapping(to_shape(field.geom)) if field.geom else None,
    }

    # Latest layer
    layer_result = await db.execute(
        select(RasterLayer)
        .where(RasterLayer.field_id == field.id, RasterLayer.layer_type == "NDVI")
        .order_by(RasterLayer.date.desc())
        .limit(1)
    )
    latest_layer = layer_result.scalar_one_or_none()

    # Stats (last 12)
    stats_result = await db.execute(
        select(FieldStat)
        .where(FieldStat.field_id == field.id)
        .order_by(FieldStat.date.desc())
        .limit(12)
    )
    stats = stats_result.scalars().all()

    # Recent alerts (last 10)
    alerts_result = await db.execute(
        select(Alert)
        .where(Alert.field_id == field.id)
        .order_by(Alert.created_at.desc())
        .limit(10)
    )
    alerts = alerts_result.scalars().all()

    # Recent scouting (last 10)
    scouting_result = await db.execute(
        select(ScoutingObservation)
        .where(ScoutingObservation.field_id == field.id)
        .order_by(ScoutingObservation.created_at.desc())
        .limit(10)
    )
    scouting_entries = scouting_result.scalars().all()

    # Convert scouting WKBElement geom_point → GeoJSON dict (same as _obs_to_out in scouting router)
    scouting_out = []
    for obs in scouting_entries:
        geom_json = None
        if obs.geom_point is not None:
            try:
                geom_json = mapping(to_shape(obs.geom_point))
            except Exception:
                pass
        scouting_out.append(
            ScoutingOut(
                id=obs.id,
                field_id=obs.field_id,
                alert_id=obs.alert_id,
                geom_point=geom_json,
                title=obs.title,
                note=obs.note,
                tags=obs.tags_json,
                photo_uri=obs.photo_uri,
                created_by=obs.created_by,
                created_at=obs.created_at,
            )
        )

    return ShareReportOut(
        field=field_data,
        latest_layer=latest_layer,
        stats=stats,
        alerts=alerts,
        scouting=scouting_out,
    )


@router.get("/share/{token}/tiles/{z}/{x}/{y}.png")
async def proxy_share_tile(
    token: str,
    z: int,
    x: int,
    y: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Public tile proxy — validates share token, proxies to TiTiler."""
    result = await db.execute(select(ShareLink).where(ShareLink.token == token))
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    now = datetime.now(timezone.utc)
    if link.revoked_at is not None or (
        link.expires_at is not None and link.expires_at < now
    ):
        raise HTTPException(status_code=410, detail="Share link expired or revoked")

    # Find latest NDVI layer for the field
    layer_result = await db.execute(
        select(RasterLayer)
        .where(RasterLayer.field_id == link.field_id, RasterLayer.layer_type == "NDVI")
        .order_by(RasterLayer.date.desc())
        .limit(1)
    )
    layer = layer_result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="No NDVI layer available")

    # Build TiTiler URL (internal)
    cog_uri = layer.cog_uri
    if cog_uri.startswith("s3://"):
        cog_uri = cog_uri.replace("s3://", "/vsis3/")
    encoded_url = quote(cog_uri, safe="")
    tiler_url = (
        f"{settings.titiler_internal_url}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png"
        f"?url={encoded_url}"
        f"&colormap_name=rdylgn&rescale=-0.2,0.9"
    )

    # Forward request with a service JWT
    service_token = _mint_service_jwt()
    client = _get_http_client()
    try:
        resp = await client.get(
            tiler_url,
            headers={"Authorization": f"Bearer {service_token}"},
        )
        if resp.status_code != 200:
            # Return transparent tile for missing/out-of-bounds tiles
            return Response(
                content=_EMPTY_TILE,
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        return Response(
            content=resp.content,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Tile server unavailable")
