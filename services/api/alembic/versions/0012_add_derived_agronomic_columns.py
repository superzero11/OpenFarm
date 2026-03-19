"""Add derived agronomic columns: ksat uncertainty, waterlogging risk, topsoil SOC stock

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "0012"
down_revision: str | None = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # soil_layers: K_sat uncertainty from Rosetta PTF
    op.add_column("soil_layers", sa.Column("ksat_q05", sa.Float(), nullable=True))
    op.add_column("soil_layers", sa.Column("ksat_q95", sa.Float(), nullable=True))

    # soil_field_summary: waterlogging risk + topsoil SOC stock
    op.add_column(
        "soil_field_summary",
        sa.Column("waterlogging_risk", sa.Float(), nullable=True),
    )
    op.add_column(
        "soil_field_summary",
        sa.Column("topsoil_soc_stock_t_ha", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("soil_field_summary", "topsoil_soc_stock_t_ha")
    op.drop_column("soil_field_summary", "waterlogging_risk")
    op.drop_column("soil_layers", "ksat_q95")
    op.drop_column("soil_layers", "ksat_q05")
