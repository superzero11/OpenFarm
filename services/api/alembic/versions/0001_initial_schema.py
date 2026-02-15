"""initial schema v1

Revision ID: 0001
Revises:
Create Date: 2026-02-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extensions ────────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "postgis"')

    # ── updated_at trigger function ───────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # ── users ─────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.execute(
        "CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )

    # ── orgs ──────────────────────────────────────────────────────────
    op.create_table(
        "orgs",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column(
            "created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.execute(
        "CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON orgs FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )

    # ── org_members ───────────────────────────────────────────────────
    op.create_table(
        "org_members",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.Text, nullable=False, server_default="member"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.UniqueConstraint("org_id", "user_id", name="uq_org_members_org_user"),
    )
    op.execute(
        "CREATE TRIGGER trg_org_members_updated_at BEFORE UPDATE ON org_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )

    # ── invites ───────────────────────────────────────────────────────
    op.create_table(
        "invites",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("role", sa.Text, nullable=False, server_default="member"),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column(
            "invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── farms ─────────────────────────────────────────────────────────
    op.create_table(
        "farms",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("country", sa.Text, nullable=True),
        sa.Column("region", sa.Text, nullable=True),
        sa.Column("timezone", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "CREATE TRIGGER trg_farms_updated_at BEFORE UPDATE ON farms FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )
    op.create_index("ix_farms_org_id", "farms", ["org_id"])

    # ── fields ────────────────────────────────────────────────────────
    op.create_table(
        "fields",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "farm_id",
            UUID(as_uuid=True),
            sa.ForeignKey("farms.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("geom", Geometry("MULTIPOLYGON", srid=4326), nullable=False),
        sa.Column("area_ha", sa.Numeric, nullable=True),
        sa.Column("crop_type", sa.Text, nullable=True),
        sa.Column("season", sa.Text, nullable=True),
        sa.Column("tags_json", JSONB, nullable=True),
        sa.Column(
            "created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "CREATE TRIGGER trg_fields_updated_at BEFORE UPDATE ON fields FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )
    op.create_index("ix_fields_org_id", "fields", ["org_id"])
    op.create_index("ix_fields_farm_id", "fields", ["farm_id"])
    op.execute("CREATE INDEX ix_fields_geom ON fields USING GIST (geom);")

    # ── raster_layers ─────────────────────────────────────────────────
    op.create_table(
        "raster_layers",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("layer_type", sa.Text, nullable=False, server_default="NDVI"),
        sa.Column("satellite", sa.Text, nullable=False, server_default="S2"),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("cog_uri", sa.Text, nullable=False),
        sa.Column("min", sa.Numeric, nullable=True),
        sa.Column("max", sa.Numeric, nullable=True),
        sa.Column("params_json", JSONB, nullable=True),
        sa.Column("provenance_json", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("ix_raster_layers_field_id", "raster_layers", ["field_id"])
    op.create_index("ix_raster_layers_org_id", "raster_layers", ["org_id"])

    # ── field_stats ───────────────────────────────────────────────────
    op.create_table(
        "field_stats",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "layer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("raster_layers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("mean", sa.Numeric, nullable=True),
        sa.Column("median", sa.Numeric, nullable=True),
        sa.Column("min", sa.Numeric, nullable=True),
        sa.Column("max", sa.Numeric, nullable=True),
        sa.Column("p10", sa.Numeric, nullable=True),
        sa.Column("p90", sa.Numeric, nullable=True),
        sa.Column("stddev", sa.Numeric, nullable=True),
        sa.Column("quality_score", sa.Numeric, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("ix_field_stats_field_id", "field_stats", ["field_id"])

    # ── alerts ────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("severity", sa.Text, nullable=False),
        sa.Column("rule_name", sa.Text, nullable=False),
        sa.Column("rule_params_json", JSONB, nullable=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.execute(
        "CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )
    op.create_index("ix_alerts_field_id", "alerts", ["field_id"])
    op.create_index("ix_alerts_org_id", "alerts", ["org_id"])

    # ── scouting_observations ─────────────────────────────────────────
    op.create_table(
        "scouting_observations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "alert_id",
            UUID(as_uuid=True),
            sa.ForeignKey("alerts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("geom_point", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("tags_json", JSONB, nullable=True),
        sa.Column("photo_uri", sa.Text, nullable=True),
        sa.Column(
            "created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.execute(
        "CREATE TRIGGER trg_scouting_updated_at BEFORE UPDATE ON scouting_observations FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )
    op.create_index("ix_scouting_field_id", "scouting_observations", ["field_id"])

    # ── jobs ──────────────────────────────────────────────────────────
    op.create_table(
        "jobs",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("progress_json", JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("params_json", JSONB, nullable=True),
        sa.Column(
            "created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_jobs_org_id", "jobs", ["org_id"])
    op.create_index("ix_jobs_field_id", "jobs", ["field_id"])

    # ── audit_events ──────────────────────────────────────────────────
    op.create_table(
        "audit_events",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("metadata_json", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("ix_audit_events_org_id", "audit_events", ["org_id"])

    # ── share_links ───────────────────────────────────────────────────
    op.create_table(
        "share_links",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.Text, nullable=False, unique=True),
        sa.Column("scope", sa.Text, nullable=False, server_default="public"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True
        ),
        sa.Column(
            "created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("ix_share_links_field_id", "share_links", ["field_id"])
    op.create_index("ix_share_links_token", "share_links", ["token"])


def downgrade() -> None:
    op.drop_table("share_links")
    op.drop_table("audit_events")
    op.drop_table("jobs")
    op.drop_table("scouting_observations")
    op.drop_table("alerts")
    op.drop_table("field_stats")
    op.drop_table("raster_layers")
    op.drop_table("fields")
    op.drop_table("farms")
    op.drop_table("invites")
    op.drop_table("org_members")
    op.drop_table("orgs")
    op.drop_table("users")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")
