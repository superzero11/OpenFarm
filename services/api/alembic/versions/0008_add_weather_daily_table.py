"""Add weather_daily table for per-field daily weather data.

Stores raw Open-Meteo variables + pre-computed agricultural indices
(GDD, water balance, drought index) for each field per day.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0008"
down_revision = "0007"


def upgrade() -> None:
    op.create_table(
        "weather_daily",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "org_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orgs.id"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=False),
        # Raw Open-Meteo variables
        sa.Column("temperature_2m_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("temperature_2m_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("temperature_2m_mean", sa.Numeric(5, 2), nullable=True),
        sa.Column("precipitation_sum", sa.Numeric(6, 2), nullable=True),
        sa.Column("et0_fao_mm", sa.Numeric(6, 2), nullable=True),
        sa.Column("soil_temperature_0cm", sa.Numeric(5, 2), nullable=True),
        sa.Column("soil_temperature_6cm", sa.Numeric(5, 2), nullable=True),
        sa.Column("soil_temperature_18cm", sa.Numeric(5, 2), nullable=True),
        sa.Column("soil_temperature_54cm", sa.Numeric(5, 2), nullable=True),
        sa.Column("soil_moisture_0_1cm", sa.Numeric(5, 3), nullable=True),
        sa.Column("soil_moisture_1_3cm", sa.Numeric(5, 3), nullable=True),
        sa.Column("soil_moisture_3_9cm", sa.Numeric(5, 3), nullable=True),
        sa.Column("soil_moisture_9_27cm", sa.Numeric(5, 3), nullable=True),
        sa.Column("soil_moisture_27_81cm", sa.Numeric(5, 3), nullable=True),
        sa.Column("vapor_pressure_deficit", sa.Numeric(5, 2), nullable=True),
        sa.Column("shortwave_radiation_sum", sa.Numeric(7, 2), nullable=True),
        sa.Column("wind_speed_10m_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("cloud_cover_mean", sa.Integer, nullable=True),
        # Derived agricultural indices
        sa.Column("gdd_daily", sa.Numeric(5, 1), nullable=True),
        sa.Column("gdd_cumulative", sa.Numeric(8, 1), nullable=True),
        sa.Column("water_balance_30d_mm", sa.Numeric(7, 2), nullable=True),
        sa.Column("drought_index", sa.Numeric(5, 2), nullable=True),
        sa.Column("heat_stress_flag", sa.Boolean, nullable=True),
        # Metadata
        sa.Column("source", sa.Text, nullable=True, server_default="open-meteo"),
        sa.Column("model_used", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("field_id", "date", name="uq_weather_field_date"),
    )

    op.create_index(
        "idx_weather_field_date",
        "weather_daily",
        ["field_id", sa.text("date DESC")],
    )
    op.create_index(
        "idx_weather_org_id",
        "weather_daily",
        ["org_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_weather_org_id", table_name="weather_daily")
    op.drop_index("idx_weather_field_date", table_name="weather_daily")
    op.drop_table("weather_daily")
