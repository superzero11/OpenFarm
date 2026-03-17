"""Add indexes on frequently-queried FK columns.

These columns are filtered in listing endpoints but lack indexes,
causing sequential scans on large tables.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade() -> None:
    op.create_index("ix_alerts_field_id", "alerts", ["field_id"], if_not_exists=True)
    op.create_index(
        "ix_field_stats_field_id", "field_stats", ["field_id"], if_not_exists=True
    )
    op.create_index(
        "ix_field_stats_layer_id", "field_stats", ["layer_id"], if_not_exists=True
    )
    op.create_index("ix_jobs_field_id", "jobs", ["field_id"], if_not_exists=True)
    op.create_index(
        "ix_scouting_observations_field_id",
        "scouting_observations",
        ["field_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_scouting_observations_field_id", "scouting_observations")
    op.drop_index("ix_jobs_field_id", "jobs")
    op.drop_index("ix_field_stats_layer_id", "field_stats")
    op.drop_index("ix_field_stats_field_id", "field_stats")
    op.drop_index("ix_alerts_field_id", "alerts")
