# Changelog

All notable changes to OpenFarm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Changelog page visible in-app under sidebar navigation.
- SAVI L factor displayed on layer cards in field detail sidebar.

### Fixed
- Index tab order on field detail page now matches sidebar order (NDVI → EVI → SAVI → NDWI).
- "Start Processing" button no longer stays disabled after a completed analysis job.
- SAVI L factor now persisted in `params_json` on raster layers during pipeline processing.
- API response for raster layers now includes `params_json` field.

---

## [0.3.0] - 2026-03-16

### Added
- Multi-index vegetation analysis: EVI, SAVI (configurable L factor), and NDWI alongside existing NDVI.
- Index-specific colormaps and rescale ranges powered by a centralized `INDEX_REGISTRY`.
- Per-index alert thresholds and severity rules.
- Index type selector on field detail page, share page, and alert filters.
- Job step progress labels for all four index types.
- English and Spanish translations for all new index-related UI strings.

### Changed
- Raster layer unique constraint now includes `layer_type` (migration `0003`).
- Alerts table extended with `index_type` column (migration `0002`).
- Share page reports grouped by index type with toggle selector.
- Tile URLs use per-index colormap/rescale from registry instead of hardcoded NDVI values.

### Fixed
- Containers no longer run as root — both API and Tiler Dockerfiles use a dedicated `appuser`.
- Upload endpoint now whitelists `image/jpeg`, `image/png`, `image/webp` content types only.
- `httpx.AsyncClient` lifecycle managed via FastAPI lifespan (created on startup, closed on shutdown) instead of leaked global.
- Farm soft-delete cascade is now atomic (single `UPDATE` statement instead of select-and-loop).
- Shapely `is_valid` check added to field geometry creation/update to reject invalid polygons.
- Pagination offset capped at 100,000 to prevent expensive sequential scans.
- Next.js database pool increased from 3 to 10 connections.
- Organization context errors now show user-facing toast instead of silent `console.error`.

### Security
- Documented JWT-in-tile-URL trade-off in `SECURITY.md` with mitigations.
- Added rate limits (`10/minute`) to `create_invite`, `remove_member`, and `cancel_invite` org endpoints.
- Added Alembic migration `0004` with database indexes on `alerts.field_id`, `field_stats.field_id`, `field_stats.layer_id`, `jobs.field_id`, and `scouting_observations.field_id`.
- Web service healthcheck added to `docker-compose.yml`.

---

## [0.2.0] - 2026-02-01

### Added
- Share links with public field reports and tile proxy.
- Scouting observations with photo uploads via presigned MinIO URLs.
- Organization invites with email notifications (Resend).
- Audit event logging for all sensitive operations.
- Role-based access control: owner, admin, member, viewer.
- Rate limiting on job creation and upload endpoints.

### Changed
- CORS configuration moved to environment variable.

---

## [0.1.0] - 2025-12-15

### Added
- Initial release of OpenFarm platform.
- Google OAuth authentication with NextAuth and JWT bridge to FastAPI.
- Multi-tenant organization support with workspace switching.
- Farm and field CRUD with GeoJSON geometry and PostGIS storage.
- NDVI vegetation index pipeline: Sentinel-2 STAC search, band download, COG generation, zonal statistics.
- TiTiler integration for COG tile serving with colormap rendering.
- MapLibre GL JS map with PMTiles basemap and field/raster overlays.
- Time-series charts with Apache ECharts.
- Alert system with threshold and drop-percentage rules.
- Celery worker for async satellite data processing.
- Docker Compose stack: PostgreSQL+PostGIS, Redis, MinIO, TiTiler, Caddy.
- Internationalization with next-intl (English, Spanish).
- Structured logging with structlog (API) and pino (web).
