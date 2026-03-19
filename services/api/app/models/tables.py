"""SQLAlchemy ORM models — mirrors 0001_initial_schema.py."""

from __future__ import annotations

import uuid
from datetime import date as _date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Auth / RBAC ──────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    memberships: Mapped[list[OrgMember]] = relationship(
        back_populates="user", lazy="selectin"
    )


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    members: Mapped[list[OrgMember]] = relationship(
        back_populates="org", lazy="selectin"
    )


class OrgMember(Base):
    __tablename__ = "org_members"
    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_member"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    org: Mapped[Org] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ── Farms / Fields ───────────────────────────────────────────────────


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str | None] = mapped_column(String(3), nullable=True)
    region: Mapped[str | None] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    fields: Mapped[list[Field]] = relationship(back_populates="farm", lazy="selectin")


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    farm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("farms.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    area_ha: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    crop_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    season: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags_json = mapped_column(JSONB, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    farm: Mapped[Farm] = relationship(back_populates="fields")


# ── Observations / Layers ────────────────────────────────────────────


class RasterLayer(Base):
    __tablename__ = "raster_layers"
    __table_args__ = (
        UniqueConstraint(
            "field_id", "date", "layer_type", name="uq_raster_field_date_type"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False
    )
    layer_type: Mapped[str] = mapped_column(Text, nullable=False, default="NDVI")
    satellite: Mapped[str] = mapped_column(Text, nullable=False, default="S2")
    date: Mapped[_date] = mapped_column(Date, nullable=False)
    cog_uri: Mapped[str] = mapped_column(Text, nullable=False)
    min: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    max: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    params_json = mapped_column(JSONB, nullable=True)
    provenance_json = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FieldStat(Base):
    __tablename__ = "field_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False, index=True
    )
    layer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("raster_layers.id"), nullable=False, index=True
    )
    date: Mapped[_date] = mapped_column(Date, nullable=False)
    mean: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    median: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    min: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    max: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    p10: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    p90: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    stddev: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ── Alerts / Scouting ────────────────────────────────────────────────


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False, index=True
    )
    date: Mapped[_date] = mapped_column(Date, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_params_json = mapped_column(JSONB, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    index_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default="ndvi"
    )
    weather_context = mapped_column(JSONB, nullable=True)
    soil_context = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ScoutingObservation(Base):
    __tablename__ = "scouting_observations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False, index=True
    )
    alert_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("alerts.id"), nullable=True
    )
    geom_point = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags_json = mapped_column(JSONB, nullable=True)
    photo_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    weather_snapshot = mapped_column(JSONB, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ── Jobs / Audit / Share ─────────────────────────────────────────────


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    progress_json = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    params_json = mapped_column(JSONB, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    metadata_json = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ShareLink(Base):
    __tablename__ = "share_links"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    scope: Mapped[str] = mapped_column(String(50), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ── Boundary Detection ───────────────────────────────────────────────


class DetectedBoundary(Base):
    __tablename__ = "detected_boundaries"
    __table_args__ = (
        Index("ix_detected_boundaries_org_id", "org_id"),
        Index("ix_detected_boundaries_job_id", "job_id"),
        Index("ix_detected_boundaries_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False
    )
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    area_ha: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    accepted_field_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fields.id"), nullable=True
    )
    detection_date: Mapped[_date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ── Weather Data ─────────────────────────────────────────────────────


class WeatherDaily(Base):
    __tablename__ = "weather_daily"
    __table_args__ = (
        UniqueConstraint("field_id", "date", name="uq_weather_field_date"),
        Index("idx_weather_field_date", "field_id", "date"),
        Index("idx_weather_org_id", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[_date] = mapped_column(Date, nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 8), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(11, 8), nullable=False)

    # Raw Open-Meteo variables
    temperature_2m_min: Mapped[float | None] = mapped_column(Numeric(5, 2))
    temperature_2m_max: Mapped[float | None] = mapped_column(Numeric(5, 2))
    temperature_2m_mean: Mapped[float | None] = mapped_column(Numeric(5, 2))
    precipitation_sum: Mapped[float | None] = mapped_column(Numeric(6, 2))
    et0_fao_mm: Mapped[float | None] = mapped_column(Numeric(6, 2))
    soil_temperature_0cm: Mapped[float | None] = mapped_column(Numeric(5, 2))
    soil_temperature_6cm: Mapped[float | None] = mapped_column(Numeric(5, 2))
    soil_temperature_18cm: Mapped[float | None] = mapped_column(Numeric(5, 2))
    soil_temperature_54cm: Mapped[float | None] = mapped_column(Numeric(5, 2))
    soil_moisture_0_1cm: Mapped[float | None] = mapped_column(Numeric(5, 3))
    soil_moisture_1_3cm: Mapped[float | None] = mapped_column(Numeric(5, 3))
    soil_moisture_3_9cm: Mapped[float | None] = mapped_column(Numeric(5, 3))
    soil_moisture_9_27cm: Mapped[float | None] = mapped_column(Numeric(5, 3))
    soil_moisture_27_81cm: Mapped[float | None] = mapped_column(Numeric(5, 3))
    vapor_pressure_deficit: Mapped[float | None] = mapped_column(Numeric(5, 2))
    shortwave_radiation_sum: Mapped[float | None] = mapped_column(Numeric(7, 2))
    wind_speed_10m_max: Mapped[float | None] = mapped_column(Numeric(5, 2))
    cloud_cover_mean: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Derived agricultural indices
    gdd_daily: Mapped[float | None] = mapped_column(Numeric(5, 1))
    gdd_cumulative: Mapped[float | None] = mapped_column(Numeric(8, 1))
    water_balance_30d_mm: Mapped[float | None] = mapped_column(Numeric(7, 2))
    drought_index: Mapped[float | None] = mapped_column(Numeric(5, 2))
    heat_stress_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Metadata
    source: Mapped[str | None] = mapped_column(Text, server_default="open-meteo")
    model_used: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ── Soil Data ────────────────────────────────────────────────────────


class SoilProfile(Base):
    __tablename__ = "soil_profiles"
    __table_args__ = (
        Index("idx_soil_profiles_field_id", "field_id"),
        Index("idx_soil_profiles_org_id", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
    )
    source: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # soilgrids | polaris
    source_resolution_m: Mapped[int | None] = mapped_column(Integer)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    layers = relationship(
        "SoilLayer", back_populates="profile", cascade="all, delete-orphan"
    )


class SoilLayer(Base):
    __tablename__ = "soil_layers"
    __table_args__ = (
        UniqueConstraint(
            "profile_id", "depth_top_cm", name="uq_soil_layer_profile_depth"
        ),
        Index("idx_soil_layers_profile_id", "profile_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("soil_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Depth range (GlobalSoilMap standard: 0-5, 5-15, 15-30, 30-60, 60-100, 100-200 cm)
    depth_top_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    depth_bottom_cm: Mapped[int] = mapped_column(Integer, nullable=False)

    # Baseline properties
    sand_pct: Mapped[float | None] = mapped_column(Float)
    silt_pct: Mapped[float | None] = mapped_column(Float)
    clay_pct: Mapped[float | None] = mapped_column(Float)
    ph: Mapped[float | None] = mapped_column(Float)
    soc_g_kg: Mapped[float | None] = mapped_column(Float)  # soil organic carbon
    bd_kg_dm3: Mapped[float | None] = mapped_column(Float)  # bulk density
    cec_cmol_kg: Mapped[float | None] = mapped_column(Float)  # cation exchange capacity
    nitrogen_g_kg: Mapped[float | None] = mapped_column(Float)
    cfvo_pct: Mapped[float | None] = mapped_column(Float)  # coarse fragments vol %

    # Water retention
    fc_vol_pct: Mapped[float | None] = mapped_column(
        Float
    )  # field capacity (θ at 33kPa)
    wp_vol_pct: Mapped[float | None] = mapped_column(
        Float
    )  # wilting point (θ at 1500kPa)
    awc_mm: Mapped[float | None] = mapped_column(
        Float
    )  # available water capacity for layer
    ksat_cm_day: Mapped[float | None] = mapped_column(
        Float
    )  # saturated hydraulic conductivity

    # Texture classification
    texture_class: Mapped[str | None] = mapped_column(String(20))

    # Uncertainty (90% confidence intervals)
    sand_q05: Mapped[float | None] = mapped_column(Float)
    sand_q95: Mapped[float | None] = mapped_column(Float)
    clay_q05: Mapped[float | None] = mapped_column(Float)
    clay_q95: Mapped[float | None] = mapped_column(Float)
    ph_q05: Mapped[float | None] = mapped_column(Float)
    ph_q95: Mapped[float | None] = mapped_column(Float)
    soc_q05: Mapped[float | None] = mapped_column(Float)
    soc_q95: Mapped[float | None] = mapped_column(Float)
    ksat_q05: Mapped[float | None] = mapped_column(Float)
    ksat_q95: Mapped[float | None] = mapped_column(Float)

    profile = relationship("SoilProfile", back_populates="layers")


class SoilFieldSummary(Base):
    __tablename__ = "soil_field_summary"
    __table_args__ = (UniqueConstraint("field_id", name="uq_soil_field_summary_field"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("soil_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Aggregated properties
    dominant_texture: Mapped[str | None] = mapped_column(String(20))
    avg_ph: Mapped[float | None] = mapped_column(Float)
    total_soc_stock_t_ha: Mapped[float | None] = mapped_column(Float)
    rootzone_awc_mm: Mapped[float | None] = mapped_column(Float)  # 0-100cm integrated
    drainage_class: Mapped[str | None] = mapped_column(String(30))

    # Risk scores (0–1 scale)
    acidification_risk: Mapped[float | None] = mapped_column(Float)
    compaction_risk: Mapped[float | None] = mapped_column(Float)
    leaching_risk: Mapped[float | None] = mapped_column(Float)
    rooting_constraint: Mapped[float | None] = mapped_column(Float)
    waterlogging_risk: Mapped[float | None] = mapped_column(Float)

    # Carbon
    topsoil_soc_stock_t_ha: Mapped[float | None] = mapped_column(Float)  # 0-30cm

    # Data quality
    data_quality_score: Mapped[float | None] = mapped_column(
        Float
    )  # 0–1, higher=better

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
