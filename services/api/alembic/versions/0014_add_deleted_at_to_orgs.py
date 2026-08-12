"""Add deleted_at to orgs so a workspace can be soft-deleted

Farms and fields already carry deleted_at; orgs did not, so there was no
way to remove a workspace without destroying its rows. This adds the
column and a partial index, since every org read filters on it.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "0014"
down_revision: str | None = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orgs", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Every listing filters deleted_at IS NULL; index only the live rows.
    op.create_index(
        "ix_orgs_active",
        "orgs",
        ["id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_orgs_active", table_name="orgs")
    op.drop_column("orgs", "deleted_at")
