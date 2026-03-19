"""Add soil_context JSONB to alerts for soil-based alert metadata

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision: str = "0013"
down_revision: str | None = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("alerts", sa.Column("soil_context", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("alerts", "soil_context")
