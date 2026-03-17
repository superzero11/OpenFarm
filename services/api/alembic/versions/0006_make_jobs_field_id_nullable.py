"""Make jobs.field_id nullable for area-based detection jobs.

Revision ID: 0006
Revises: 0005
"""

from alembic import op

revision = "0006"
down_revision = "0005"


def upgrade() -> None:
    op.alter_column("jobs", "field_id", nullable=True)


def downgrade() -> None:
    op.alter_column("jobs", "field_id", nullable=False)
