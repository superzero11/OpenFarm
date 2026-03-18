"""OpenFarm API — Core configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://openfarm:openfarm_dev@db:5432/openfarm"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    openfarm_jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_ttl_seconds: int = 3600  # 1 hour

    # MinIO
    minio_endpoint: str = "minio:9000"
    # Browser-reachable endpoint for presigned URLs (empty = use minio_endpoint)
    minio_public_endpoint: str = ""
    minio_access_key: str = "openfarm"
    minio_secret_key: str = "openfarm_dev_secret"
    minio_bucket: str = "openfarm"
    minio_secure: bool = False

    # CORS
    cors_origins: str = "http://localhost:3000"

    # STAC
    stac_api_url: str = "https://earth-search.aws.element84.com/v1"

    # TiTiler
    titiler_internal_url: str = "http://tiler:80"
    titiler_public_url: str = "http://localhost:8080"

    # Boundary Detection (ML)
    ftw_model_path: str = "models/ftw/prue_efnetb5_ccby_checkpoint.ckpt"
    ftw_model_cache_dir: str = "/tmp/models"
    detection_max_area_km2: float = 50.0

    # Weather (Open-Meteo)
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_archive_url: str = "https://archive-api.open-meteo.com/v1/archive"
    open_meteo_api_key: str = ""
    weather_backfill_days: int = 90
    weather_batch_size: int = 50
    weather_gdd_base_temp: float = 10.0
    weather_heat_stress_threshold: float = 32.0

    # Index Backfill
    index_backfill_months: int = 24
    index_backfill_chunk_days: int = 90
    index_weekly_batch_size: int = 50

    # Email (Resend)
    resend_api_key: str = ""
    resend_from_email: str = "OpenFarm <noreply@openfarm.app>"
    app_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
