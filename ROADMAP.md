# Roadmap

> Last updated: March 2026

This document outlines where OpenFarm is today and where it's headed. If you'd like to contribute to any of these areas, check the [Contributing Guide](CONTRIBUTING.md) and look for issues labeled [`help wanted`](https://github.com/superzero11/OpenFarm/labels/help%20wanted) or [`good first issue`](https://github.com/superzero11/OpenFarm/labels/good%20first%20issue).

---

## Platform Vision

### Layer A — Observation Infrastructure
Satellite ingestion, weather, radar, sensor plugins, field boundaries, temporal storage, provenance, exports, APIs. 

### Layer B — Intelligence Engine
Phenology, crop type, stress segmentation, anomaly detection, disease/pest risk signals, irrigation/nutrient heuristics, yield forecasting, uncertainty scoring, benchmarking.

### Layer C — Delivery Surfaces
Map UI, reports, API, webhooks, partner integrations, lightweight mobile scouting, LLM/MCP interfaces. 

---

## Current Status

OpenFarm **Phase 5 (Historical Data Backfill) is complete**. The platform delivers end-to-end satellite-powered crop intelligence with four vegetation indices (NDVI, EVI, SAVI, NDWI), ML-powered automatic field boundary detection, daily weather data with agricultural indices, and automatic 24-month historical index backfill on field creation — all functional and deployed. New fields automatically receive two years of vegetation index history, and a weekly Celery Beat schedule keeps all fields up to date. The focus now shifts to testing, documentation, and building the agricultural intelligence layer. See [Future Ideas](#future-ideas-post-mvp) for what's next.

---

## Milestone 0 — Foundation ✅

- [x] Monorepo structure (`apps/web`, `services/api`, `services/tiler`)
- [x] Docker Compose with all services (Postgres/PostGIS, Redis, MinIO, API, Celery, TiTiler, Web)
- [x] Database schema — all 13 tables with UUID PKs, PostGIS geometry, soft-delete
- [x] JWT auth (NextAuth Google OAuth → shared HS256 JWT bridge)
- [x] RBAC system (`owner` / `admin` / `member` / `viewer`)
- [x] MapLibre base map with PMTiles + 4 style options
- [x] Health checks across all services
- [x] Structured logging (structlog + pino)

## Milestone 1 — Org, Farm & Field Management ✅

- [x] Org CRUD — create, rename, member management, invites, audit log
- [x] Farm CRUD — create, edit, soft-delete, list with pagination
- [x] Field CRUD — draw polygon on map, edit vertices, GeoJSON import
- [x] Auto area calculation (hectares, geodesic)
- [x] Dashboard with org stats and quick actions
- [x] i18n support (English + Spanish)
- [x] Dark/light theme, responsive sidebar
- [x] Landing page for unauthenticated users

## Milestone 2 — NDVI Monitoring ✅

- [x] NDVI pipeline: STAC search → band download → NDVI computation → COG → MinIO
- [x] Zonal statistics (mean, median, min, max, stddev, p10, p90)
- [x] TiTiler tile serving with JWT auth
- [x] NDVI tile overlay on map with floating legend
- [x] Time-series chart (Apache ECharts) with percentile bands
- [x] Alert rules: `ndvi_drop` (15% drop) and `ndvi_threshold` (below 0.3)
- [x] Job progress tracking with 7-step sub-status

## Milestone 3 — Alerts, Scouting & Sharing ✅

- [x] Alerts API + UI — list with severity badges, close/acknowledge, notification badges
- [x] Alerts page with field/farm/status filters
- [x] Scouting API + UI — create/list observations, pin on map, photo upload via presigned URLs
- [x] Scouting observations as interactive map markers
- [x] Share API + UI — create/revoke share links with expiry, copy URL
- [x] Public report page (`/share/[token]`) — map, NDVI snapshot, time-series chart, alerts, scouting notes

## Milestone 4 — Polish, Security & QA ✅

- [x] Viewer role enforcement across all routers
- [x] Rate limiting (slowapi) — Redis-backed, per-endpoint limits
- [x] Pagination consistency — all list endpoints use `PaginatedResponse` envelope
- [x] Audit log UI in settings page — event icons, search, pagination
- [x] Frontend structured logging (pino)
- [x] Celery worker health check in Docker Compose
- [x] Backup script (`deploy/backup.sh`) — automated daily pg_dump, 7-day retention
- [x] MinIO bucket versioning + WAL archiving/PITR documentation
- [ ] API unit/integration tests
- [ ] Frontend component tests
- [ ] E2E acceptance tests

## Milestone 5 — Multi-Index Vegetation Analysis ✅

- [x] Index registry (`INDEX_REGISTRY`) — pluggable formula, bands, colormap, rescale, alert defaults
- [x] EVI pipeline: `2.5 × (B08−B04) / (B08 + 6×B04 − 7.5×B02 + 1)`
- [x] SAVI pipeline: `((B08−B04)/(B08+B04+L)) × (1+L)` with configurable L factor (0–1)
- [x] NDWI pipeline: `(B03−B08)/(B03+B08)` for water stress detection
- [x] Per-index colormaps (rdylgn for NDVI/EVI/SAVI, rdbu for NDWI)
- [x] Per-index alert rules with configurable thresholds and drop percentages
- [x] Generalized job endpoint (`POST /fields/{id}/jobs/index`) + backward-compatible NDVI alias
- [x] Index selector UI on field detail page with floating map toggle
- [x] Multi-index job submission from single form
- [x] Per-index chart, legend, layer list, and map overlay
- [x] Share page with index toggle for multi-index reports
- [x] Full i18n translations (English + Spanish) for all index UI strings

## Milestone 6 — Security Hardening & Code Quality ✅

- [x] Non-root containers (API + Tiler Dockerfiles)
- [x] Upload content-type whitelist (JPEG, PNG, WebP only)
- [x] JWT-in-tile-URL security trade-off documented in SECURITY.md
- [x] httpx client lifecycle via FastAPI lifespan
- [x] Missing FK indexes added (alerts, field_stats, jobs, scouting)
- [x] Shapely geometry validation with descriptive error messages
- [x] Atomic farm soft-delete cascade
- [x] Pagination offset cap (100,000)
- [x] Rate limits on invitation/member management endpoints
- [x] Shared `wkb_to_geojson()` utility to reduce code duplication
- [x] Index task map derived from registry (single source of truth)
- [x] SAVI L factor stored in layer `params_json` and displayed in UI
- [x] In-app changelog page with parsed Keep a Changelog rendering

## Milestone 7 — Automatic Boundary Detection ✅

- [x] FTW (Fields of The World) deep learning model integration for field boundary detection
- [x] Dedicated ML processor Docker service with PyTorch, torchgeo, and model weights
- [x] Detection API — trigger, list, accept, discard, with org-scoped access control
- [x] Full-page detection UI (`/farms/[id]/detect`) with draw → detecting → review workflow
- [x] Interactive polygon drawing with MapLibre GL Draw (draw, move, edit vertices, delete)
- [x] Viewport preservation across phase transitions
- [x] Boundary review with confidence scores, bulk accept/discard, zoom-to-boundary
- [x] Boundary geometry editing before accepting as a field
- [x] 7-step progress tracking (validate → STAC search → download → prepare → inference → polygonize → store)
- [x] Alembic migrations for detected boundaries, nullable job field_id, updated_at
- [x] i18n translations (English + Spanish) for all detection UI

## Milestone 8 — Weather Data Integration ✅

- [x] `weather_daily` table with 18 raw variables + 5 derived indices + metadata
- [x] Open-Meteo API integration (free, CC BY 4.0) for forecast + historical archive (ERA5)
- [x] Celery task `fetch_weather_for_field` — centroid-based fetch, GDD/water balance/drought index computation, upsert
- [x] Celery task `schedule_daily_weather_fetch` — Beat schedule at 08:00 UTC, batched by 50
- [x] Celery task `backfill_weather_for_field` — 90-day historical fetch on demand
- [x] API: `GET /fields/{id}/weather` with date range + optional 7-day forecast
- [x] API: `GET /fields/{id}/weather/summary` — 30-day aggregated stats
- [x] API: `POST /fields/{id}/weather/backfill` — manual trigger (202 Accepted)
- [x] Alert enrichment — `weather_context` JSONB on alerts (precip 7d, ET₀, deficit, soil moisture, GDD, drought index)
- [x] Scouting weather snapshot — auto-attached 7-day weather context on observation creation
- [x] Share report — `weather_summary` + `weather_data` (90 days) in public report endpoint
- [x] Weather tab — summary cards, 7-day forecast bar, temp+precip chart, ET₀+water balance chart
- [x] Soil moisture gauge — 5-depth horizontal bars with color coding
- [x] Soil temperature display — 4-depth bars (surface, 6cm, 18cm, 54cm)
- [x] Vapor pressure deficit (VPD) — value with zone classification (low/ideal/moderate/high)
- [x] NDVI + weather overlay chart — dual-axis with precip bars + ET₀ line, toggle in Indices tab
- [x] Alembic migrations: weather_daily table (0008), weather_context on alerts (0009), weather_snapshot on scouting (0010)
- [x] Config settings: Open-Meteo URLs, backfill days, batch size, GDD base temp, heat stress threshold
- [x] i18n translations (English + Spanish) for all weather UI strings

## Milestone 9 — Historical Data Backfill ✅

- [x] Backfill orchestrator task — splits 24-month range into 90-day chunks, dispatches one job per (chunk × index) with staggered countdowns
- [x] Chunk-level and index-level deduplication — skips chunks/indices where raster data already exists
- [x] Alert suppression — backfill pipeline runs do not create alerts (`is_backfill` flag in `params_json`)
- [x] Auto-trigger on field creation — new fields automatically get 24 months of all 4 vegetation indices
- [x] Weekly auto-compute Celery Beat schedule (`schedule_weekly_index_compute`) — Monday 06:00 UTC, skips fresh fields
- [x] Manual backfill API: `POST /fields/{id}/backfill-indices` (admin/owner, rate-limited 1/min)
- [x] Backfill status API: `GET /fields/{id}/backfill-status` — pending, running, completed job counts
- [x] Endpoint-level deduplication — 409 Conflict if backfill already in progress
- [x] Sentinel job pattern — synchronous placeholder job before async dispatch to prevent race conditions
- [x] Batch backfill task (`backfill_all_existing_fields`) for retroactive backfill of all org fields
- [x] Backfill History button on Indices tab with active-backfill detection and progress banner
- [x] Config settings: `index_backfill_months` (24), `index_backfill_chunk_days` (90)
- [x] i18n translations (English + Spanish) for all backfill UI strings

---

## Future Ideas (Post-MVP)

These are under consideration but not yet committed. Grouped by theme and ordered by dependency — items higher in each list are prerequisites for items below them.

### Platform Foundations
- ~~**Historical data backfill**~~ — ✅ completed in Milestone 9
- **Data export** — export field data, stats, and reports in CSV, GeoJSON, PDF formats
- **Custom index builder** — UI for users to define custom indices from available bands with formula editor and visualization
- **User roles and permissions** — more granular permissions (e.g., field-level access, read-only API keys) and user groups
- **Email/Microsoft & Enterprise SSO** — support email/password, Microsoft OAuth, and SAML/OIDC for enterprise identity providers
- **Direct API integration** — stable, versioned public API with API keys for integrating OpenFarm into existing farm management software
- **Multi-satellite support** — Landsat, Planet (currently Sentinel-2 only) _(prerequisite for higher-frequency monitoring)_
- **Higher-frequency monitoring** — support for daily revisit satellites (e.g., PlanetScope) for near real-time crop monitoring
- **Higher-res imagery** — support for sub-meter commercial imagery for detailed crop monitoring _(prerequisite for tree canopy analysis, individual tree detection)_
- **Drone imagery support** — ingest and process high-res drone imagery for field-level insights _(depends on higher-res imagery pipeline)_

### Agricultural Intelligence

Items are ordered by dependency. Each layer builds on the one above it.

**Layer 1 — Statistical analysis (CPU-only, builds on existing indices + weather)**
- **Anomaly detection** — statistical detection of unusual patterns in vegetation index time series (z-score, moving average deviation from historical baseline) _(historical backfill ✅)_
- **Phenology tracking** — track crop growth stages and phenological events from NDVI/EVI temporal curves _(historical backfill ✅)_
- **Drought and water stress monitoring** — composite risk scoring from existing drought index, NDWI, soil moisture, ET₀, and water balance data _(extends existing weather + NDWI features)_

**Layer 2 — Composite intelligence (builds on Layer 1)**
- **Disease/pest risk signals** — risk scoring framework combining vegetation anomalies, weather conditions, and regional pest data _(depends on anomaly detection + weather)_
- **Soil moisture estimation** — enhanced soil moisture modeling combining remote sensing indices with in-situ sensor data _(depends on drought/water stress monitoring)_

**Layer 3 — Actionable recommendations (builds on Layer 2)**
- **Yield analysis and forecasting** — predict yield from historical NDVI trends, weather, and field data _(depends on phenology + anomaly detection + weather)_
- **Harvest timing recommendations** — optimal harvest windows based on crop maturity models and vegetation indices _(depends on phenology tracking)_
- **Fertilizer and irrigation recommendations** — actionable insights based on crop health trends, weather forecasts, and agronomic models _(depends on disease risk + water stress)_

**Layer 4 — ML-powered classification (requires GPU + fine-tuned models)**
- **Crop detection and classification** — ML-based crop type identification from multi-temporal spectral data using foundation models _(see [research doc](docs/features/crop-tree-detection.md))_
- **Tree detection and classification** — ML-based tree crop identification and health monitoring _(depends on crop classification pipeline)_
- **Nutrient deficiency detection** — identify spectral signatures of common nutrient deficiencies for early intervention _(depends on additional spectral bands from crop classification pipeline)_
- **Tree canopy analysis** — canopy cover, leaf area index, and tree height estimation _(depends on higher-res imagery)_

**Layer 5 — Advanced modeling (builds on everything above)**
- **Climate impact modeling** — estimate carbon sequestration, emissions, and climate impact of farming practices using field data and agronomic models _(depends on yield forecasting + crop classification)_
- **Carbon/sustainability reporting** — track and report carbon sequestration, emissions, and sustainability metrics _(depends on climate impact modeling)_

### Analytics & Workflows
- **Field comparison** — side-by-side health comparison across fields
- **Historical analytics** — season-over-season trend analysis _(historical backfill ✅)_
- **Webhook/notification system** — email, Slack, or SMS on alerts _(prerequisite for advanced workflows)_
- **Advanced analytics and reporting framework** — customizable dashboards, scheduled reports, and data export _(depends on field comparison + historical analytics)_
- **Advanced workflows** — rule-based automation (e.g., auto-trigger analysis on new imagery, scheduled monitoring) _(depends on webhook/notification system)_

### Ecosystem & Integrations
- **Direct API integration** — stable, versioned public API with API keys _(prerequisite for MCP + AI agent integration)_
- **Plugin system** — extensible processing pipelines for custom analysis _(prerequisite for device/sensor framework)_
- **Model Context Protocol (MCP) server** — standardized interface for AI agents to query field data and trigger analysis _(depends on API integration)_
- **AI agent integration** — connect to LLMs for natural language insights, recommendations, and conversational interfaces _(depends on MCP server)_
- **Device/Sensor plugin framework** — connect soil sensors, weather stations, and IoT devices _(depends on plugin system)_
- **Machinery telemetry integration** — ingest GPS tracks and operational data from farm equipment _(depends on device/sensor framework)_
- **Supply chain / traceability integrations** — link field data to downstream logistics and compliance systems
- **Community data sharing** — opt-in anonymized data sharing for regional insights and benchmarking

### Enterprise & Scale
- **Enterprise admin controls** — SSO enforcement, audit policies, usage quotas, multi-tenant admin
- **Mobile app** — React Native companion for field scouting
- **Custom analytics packs per vertical** — tailored modules for tree crops, forestry, viticulture, etc. _(depends on analytics framework)_
- **Modular ERP** — lightweight farm operations management (inventory, tasks, financials)
- **Hosted offering** — managed cloud version _(depends on enterprise admin controls)

---

## How to Contribute

The MVP is complete! The highest-impact contributions right now are:

1. **Automated tests** — API integration tests, frontend component tests, and E2E acceptance tests (Milestone 4 remaining items)
2. **Future Ideas** — pick any item from the list above or browse [open issues](https://github.com/superzero11/OpenFarm/issues)

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.
