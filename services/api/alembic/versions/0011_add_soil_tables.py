"""add soil tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "soil_profiles",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("field_id", sa.UUID(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("source_resolution_m", sa.Integer(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["field_id"], ["fields.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_soil_profiles_field_id", "soil_profiles", ["field_id"])
    op.create_index("idx_soil_profiles_org_id", "soil_profiles", ["org_id"])

    op.create_table(
        "soil_field_summary",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("field_id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("dominant_texture", sa.String(length=20), nullable=True),
        sa.Column("avg_ph", sa.Float(), nullable=True),
        sa.Column("total_soc_stock_t_ha", sa.Float(), nullable=True),
        sa.Column("rootzone_awc_mm", sa.Float(), nullable=True),
        sa.Column("drainage_class", sa.String(length=30), nullable=True),
        sa.Column("acidification_risk", sa.Float(), nullable=True),
        sa.Column("compaction_risk", sa.Float(), nullable=True),
        sa.Column("leaching_risk", sa.Float(), nullable=True),
        sa.Column("rooting_constraint", sa.Float(), nullable=True),
        sa.Column("data_quality_score", sa.Float(), nullable=True),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["field_id"], ["fields.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["profile_id"], ["soil_profiles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("field_id", name="uq_soil_field_summary_field"),
    )

    op.create_table(
        "soil_layers",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("depth_top_cm", sa.Integer(), nullable=False),
        sa.Column("depth_bottom_cm", sa.Integer(), nullable=False),
        sa.Column("sand_pct", sa.Float(), nullable=True),
        sa.Column("silt_pct", sa.Float(), nullable=True),
        sa.Column("clay_pct", sa.Float(), nullable=True),
        sa.Column("ph", sa.Float(), nullable=True),
        sa.Column("soc_g_kg", sa.Float(), nullable=True),
        sa.Column("bd_kg_dm3", sa.Float(), nullable=True),
        sa.Column("cec_cmol_kg", sa.Float(), nullable=True),
        sa.Column("nitrogen_g_kg", sa.Float(), nullable=True),
        sa.Column("cfvo_pct", sa.Float(), nullable=True),
        sa.Column("fc_vol_pct", sa.Float(), nullable=True),
        sa.Column("wp_vol_pct", sa.Float(), nullable=True),
        sa.Column("awc_mm", sa.Float(), nullable=True),
        sa.Column("ksat_cm_day", sa.Float(), nullable=True),
        sa.Column("texture_class", sa.String(length=20), nullable=True),
        sa.Column("sand_q05", sa.Float(), nullable=True),
        sa.Column("sand_q95", sa.Float(), nullable=True),
        sa.Column("clay_q05", sa.Float(), nullable=True),
        sa.Column("clay_q95", sa.Float(), nullable=True),
        sa.Column("ph_q05", sa.Float(), nullable=True),
        sa.Column("ph_q95", sa.Float(), nullable=True),
        sa.Column("soc_q05", sa.Float(), nullable=True),
        sa.Column("soc_q95", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["profile_id"], ["soil_profiles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "profile_id", "depth_top_cm", name="uq_soil_layer_profile_depth"
        ),
    )
    op.create_index("idx_soil_layers_profile_id", "soil_layers", ["profile_id"])


def downgrade() -> None:
    op.drop_table("soil_layers")
    op.drop_table("soil_field_summary")
    op.drop_table("soil_profiles")
