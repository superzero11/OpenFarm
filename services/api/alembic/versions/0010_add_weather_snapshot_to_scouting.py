"""Add weather_snapshot JSONB to scouting_observations."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0010"
down_revision = "0009"


def upgrade() -> None:
    op.add_column(
        "scouting_observations",
        sa.Column("weather_snapshot", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scouting_observations", "weather_snapshot")
