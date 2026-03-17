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

    # Email (Resend)
    resend_api_key: str = ""
    resend_from_email: str = "OpenFarm <noreply@openfarm.app>"
    app_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
