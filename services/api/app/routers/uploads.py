"""Uploads router — presigned URL for direct-to-MinIO photo upload."""

from __future__ import annotations

from typing import Annotated
import uuid

from fastapi import APIRouter, Depends

from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context
from app.schemas.monitoring import PresignedUploadOut, PresignedUploadRequest

router = APIRouter()


@router.post("/uploads/presign", response_model=PresignedUploadOut)
async def get_presigned_upload(
    body: PresignedUploadRequest,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
):
    """Generate a presigned PUT URL for direct-to-MinIO upload."""
    from minio import Minio
    from app.core.config import settings

    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
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
