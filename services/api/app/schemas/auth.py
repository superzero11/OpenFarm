"""Pydantic schemas — users, orgs, invites."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


# ── User ─────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMeOut(UserOut):
    orgs: list[OrgBrief] = []


class OrgBrief(BaseModel):
    id: uuid.UUID
    name: str
    role: str

    model_config = {"from_attributes": True}


# ── Org ──────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str


class OrgUpdate(BaseModel):
    name: str


class OrgOut(BaseModel):
    id: uuid.UUID
    name: str
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgDetailOut(OrgOut):
    member_count: int = 0
    farm_count: int = 0


# ── Org Members ──────────────────────────────────────────────────────

class MemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberRoleUpdate(BaseModel):
    role: str


# ── Invites ──────────────────────────────────────────────────────────

class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"


class InviteOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    role: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Rebuild forward refs
UserMeOut.model_rebuild()
