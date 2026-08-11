"""Uploads router - presigned URL for direct-to-MinIO photo upload."""

from __future__ import annotations

from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.logging import logger
from app.core.rate_limit import limiter
from app.middleware.auth import OrgContext, require_roles
from app.schemas.monitoring import PresignedUploadOut, PresignedUploadRequest

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/uploads/presign", response_model=PresignedUploadOut)
@limiter.limit("10/minute")
async def get_presigned_upload(
    request: Request,
    body: PresignedUploadRequest,
    ctx: Annotated[OrgContext, Depends(_writer)],
):
    """Generate a presigned PUT URL for direct-to-MinIO upload."""
    if body.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type. Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}",
        )
    from minio import Minio
    from app.core.config import settings

    # For presigned URLs, the signature includes the host header.
    # We must sign with the browser-reachable endpoint so the signature
    # matches when the browser sends the PUT request.
    # Setting region explicitly avoids a network call to discover it.
    signing_endpoint = settings.minio_public_endpoint or settings.minio_endpoint
    client = Minio(
        signing_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region="us-east-1",
    )

    # Generate unique object key
    ext = body.filename.rsplit(".", 1)[-1] if "." in body.filename else "jpg"
    object_key = f"photos/{ctx.org_id}/{uuid.uuid4()}.{ext}"

    from datetime import timedelta

    url = client.presigned_put_object(
        settings.minio_bucket,
        object_key,
        expires=timedelta(minutes=15),
    )

    logger.info("presigned_upload", object_key=object_key, org_id=str(ctx.org_id))
    return PresignedUploadOut(upload_url=url, object_key=object_key)
