"""Add weather_context JSONB column to alerts table.

Stores weather conditions at the time of alert creation:
water deficit, ET₀, soil moisture, GDD, etc.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0009"
down_revision = "0008"


def upgrade() -> None:
    op.add_column("alerts", sa.Column("weather_context", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("alerts", "weather_context")
