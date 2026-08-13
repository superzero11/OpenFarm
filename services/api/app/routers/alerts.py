"""Alerts router - list and update alerts."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Alert, Farm, Field
from app.schemas.common import PaginatedResponse
from app.schemas.monitoring import AlertOut, AlertSummaryOut, AlertUpdate

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")


def _with_context(stmt):
    """Attach the field and farm an alert belongs to.

    Outer joins, deliberately: an alert outlives its field, and an inner
    join would make alerts silently disappear from the list the moment
    someone deletes a field. The deleted_at condition sits in the join
    rather than in a WHERE for the same reason - it nulls the name
    without dropping the row.

    Nothing here is stored on the alert: the names are read from their
    own tables on every request, so a rename shows up immediately.
    """
    return stmt.outerjoin(
        Field, (Alert.field_id == Field.id) & Field.deleted_at.is_(None)
    ).outerjoin(Farm, (Field.farm_id == Farm.id) & Farm.deleted_at.is_(None))


def _alert_out(
    alert: Alert,
    field_name: str | None,
    farm_id: uuid.UUID | None,
    farm_name: str | None,
) -> AlertOut:
    """Build the response from an (alert, field name, farm) row."""
    return AlertOut.model_validate(alert).model_copy(
        update={
            "field_name": field_name,
            "farm_id": farm_id,
            "farm_name": farm_name,
        }
    )


@router.get("/alerts", response_model=PaginatedResponse[AlertOut])
async def list_alerts(
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    field_id: uuid.UUID | None = Query(None),
    farm_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    index_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = _with_context(select(Alert)).where(Alert.org_id == ctx.org_id)
    if field_id:
        base = base.where(Alert.field_id == field_id)
    if status_filter:
        base = base.where(Alert.status == status_filter)
    if severity:
        base = base.where(Alert.severity == severity)
    if index_type:
        base = base.where(Alert.index_type == index_type)
    if farm_id:
        base = base.where(Field.farm_id == farm_id)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    rows = (
        await db.execute(
            base.add_columns(Field.name, Farm.id, Farm.name)
            .order_by(Alert.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return PaginatedResponse(
        items=[_alert_out(*row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/alerts/summary", response_model=AlertSummaryOut)
async def alerts_summary(
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Open alert counts by severity, for the summary cards.

    One grouped query rather than four counts, and computed server-side
    so the cards report the workspace rather than whatever page of rows
    the client happens to be holding.
    """
    rows = (
        await db.execute(
            select(Alert.severity, func.count())
            .where(Alert.org_id == ctx.org_id, Alert.status == "open")
            .group_by(Alert.severity)
        )
    ).all()
    counts = {severity: count for severity, count in rows}
    return AlertSummaryOut(
        open_total=sum(counts.values()),
        high=counts.get("high", 0),
        medium=counts.get("medium", 0),
        low=counts.get("low", 0),
    )


@router.get("/fields/{field_id}/alerts", response_model=PaginatedResponse[AlertOut])
async def list_field_alerts(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = _with_context(select(Alert)).where(
        Alert.org_id == ctx.org_id, Alert.field_id == field_id
    )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    rows = (
        await db.execute(
            base.add_columns(Field.name, Farm.id, Farm.name)
            .order_by(Alert.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return PaginatedResponse(
        items=[_alert_out(*row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
async def update_alert(
    alert_id: uuid.UUID,
    body: AlertUpdate,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    alert = await db.get(Alert, alert_id)
    if not alert or alert.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Alert not found")

    if body.status not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="Status must be 'open' or 'closed'")

    alert.status = body.status
    await db.flush()
    logger.info("alert_updated", alert_id=str(alert_id), new_status=body.status)
    return alert
