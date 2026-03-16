"""add index_type to alerts

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add nullable index_type column with default
    op.add_column(
        "alerts",
        sa.Column("index_type", sa.String(20), nullable=True, server_default="ndvi"),
    )
    # Backfill existing rows
    op.execute("UPDATE alerts SET index_type = 'ndvi' WHERE index_type IS NULL")


def downgrade() -> None:
    op.drop_column("alerts", "index_type")
