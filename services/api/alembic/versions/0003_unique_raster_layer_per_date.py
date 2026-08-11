"""Add unique constraint on raster_layers (field_id, date, layer_type).

Deduplicates existing rows first - keeps the newest row per group,
deletes older duplicates, then cascades to orphaned field_stats.

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade() -> None:
    # 1. Delete field_stats that reference duplicate raster_layers
    #    (keep only the stat linked to the newest layer per group)
    op.execute("""
        DELETE FROM field_stats
        WHERE layer_id IN (
            SELECT id FROM raster_layers
            WHERE id NOT IN (
                SELECT DISTINCT ON (field_id, date, layer_type) id
                FROM raster_layers
                ORDER BY field_id, date, layer_type, created_at DESC
            )
        )
    """)

    # 2. Delete duplicate raster_layers (keep newest per group)
    op.execute("""
        DELETE FROM raster_layers
        WHERE id NOT IN (
            SELECT DISTINCT ON (field_id, date, layer_type) id
            FROM raster_layers
            ORDER BY field_id, date, layer_type, created_at DESC
        )
    """)

    # 3. Add unique constraint
    op.create_unique_constraint(
        "uq_raster_field_date_type",
        "raster_layers",
        ["field_id", "date", "layer_type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_raster_field_date_type", "raster_layers")
