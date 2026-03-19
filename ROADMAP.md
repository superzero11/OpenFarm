# Roadmap

> Last updated: March 2026

This document outlines where OpenFarm is today and where it's headed. If you'd like to contribute to any of these areas, check the [Contributing Guide](CONTRIBUTING.md) and look for issues labeled [`help wanted`](https://github.com/superzero11/OpenFarm/labels/help%20wanted) or [`good first issue`](https://github.com/superzero11/OpenFarm/labels/good%20first%20issue).

---

## Strategic Architecture

OpenFarm is built on a 3-layer architecture where each layer has a distinct strategic role:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer C — Delivery Surfaces                   (Distribution)  │
│  Map UI · Reports · API · Webhooks · MCP · Mobile scouting     │
├─────────────────────────────────────────────────────────────────┤
│  Layer B — Intelligence Engine                       (Moat)    │
│  Phenology · Anomaly detection · Stress signals · Yield        │
│  Risk models · Soil-derived insights · Explainability          │
├─────────────────────────────────────────────────────────────────┤
│  Layer A — Observation Infrastructure         (Data Gravity)   │
│  Satellite · Weather · Soil · Field boundaries · Sensors       │
└─────────────────────────────────────────────────────────────────┘
```

### Layer A — Observation Infrastructure (Data Gravity)

Collects, standardizes, and stores raw signals about every field. Source-agnostic, reproducible, and extensible.

| Domain | Current State | Next |
|---|---|---|
| **Satellite** | Sentinel-2 (NDVI, EVI, SAVI, NDWI), STAC ingestion, COG storage, 24-month backfill | Landsat, Planet, SAR (Sentinel-1), cloud masking, fusion |
| **Weather** | Open-Meteo (ERA5 + forecast), GDD, ET₀, water balance, drought index | Additional providers, irrigation scheduling inputs |
| **Soil** | SoilGrids (global 250m) + POLARIS (US 30m), 10 properties × 6 depths, texture classification, AWC, risk scoring | Derived hydraulic properties (Rosetta PTF), terrain layers |
| **Boundaries** | FTW deep learning model, interactive review, GeoJSON/KML import | Multi-model ensemble, higher-res detection |
| **Sensors** | — | IoT soil sensors, weather stations, device plugin framework |

### Layer B — Intelligence Engine (Moat)

Transforms raw observations into explainable, agronomically meaningful insights. This is the strategic differentiator — multi-signal reasoning with confidence scores and input attribution.

| Tier | Capabilities | Dependencies |
|---|---|---|
| **Statistical analysis** | Anomaly detection (z-score, CUSUM), phenology tracking, drought/water stress composite scoring | Existing indices + weather + soil |
| **Composite intelligence** | Disease/pest risk signals, enhanced soil moisture modeling, nutrient interaction modeling | Tier 1 outputs |
| **Actionable recommendations** | Yield forecasting, harvest timing, fertilizer/irrigation advisory | Tier 2 outputs |
| **ML classification** | Crop type detection, tree detection, nutrient deficiency signatures | GPU + fine-tuned models |
| **Advanced modeling** | Climate impact, carbon sequestration, sustainability reporting | All prior tiers |

Every insight carries: confidence score, contributing signal breakdown ("NDVI drop + rainfall deficit + sandy soil"), and historical comparison ("This field behaved similarly in 2022").

### Layer C — Delivery Surfaces (Distribution)

Ensures OpenFarm is a platform others can build on, not just a tool.

| Surface | Current State | Next |
|---|---|---|
| **Map UI** | MapLibre + PMTiles, layer toggles, ECharts time series, dark/light theme | Zone visualization, field comparison |
| **Reports** | Share links with multi-index + weather + soil summary | PDF export, scheduled reports, seasonal summaries |
| **API** | REST (`/v1`), JWT + RBAC, pagination, org-scoped | Versioned public API with API keys, webhooks |
| **Scouting** | Geotagged observations, photo upload, weather snapshots | Mobile-optimized, offline sync |
| **Integrations** | — | MCP server for AI agents, plugin system, machinery telemetry |
| **Exports** | — | CSV, GeoJSON, raster tiles, PDF |

---

## Current Status

OpenFarm **Milestone 10 (Soil Intelligence Foundation) is complete**. The platform delivers end-to-end satellite-powered crop intelligence with four vegetation indices (NDVI, EVI, SAVI, NDWI), ML-powered automatic field boundary detection, daily weather data with agricultural indices, automatic 24-month historical index backfill, and soil profile intelligence from SoilGrids/POLARIS — all functional and deployed. New fields automatically receive vegetation index history, weather data, and soil profile analysis on creation. The focus now shifts to derived agronomic layers (hydraulic properties, refined risk scoring) and broader agricultural intelligence. See [Future Ideas](#future-ideas-post-mvp) for what's next.

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

## Milestone 10 — Soil Intelligence Foundation ✅

- [x] `soil_profiles`, `soil_layers`, `soil_field_summary` database tables with UUID PKs and PostGIS integration
- [x] SoilGrids WCS client — 10 properties × 6 depths × 3 quantiles (mean, Q05, Q95) globally at 250m
- [x] POLARIS S3 client — 9 properties × 6 depths for US fields at 30m resolution
- [x] Automatic source routing (POLARIS for CONUS, SoilGrids globally)
- [x] USDA soil texture triangle classification (12 classes)
- [x] Available Water Capacity (AWC) computation and rootzone integration
- [x] Field summary aggregation with risk scoring (acidification, compaction, leaching, rooting)
- [x] Data quality scoring based on uncertainty spread
- [x] Celery task `fetch_soil_for_field` with retry, backoff, and partial-data handling
- [x] Auto-trigger on field creation
- [x] API: `GET /fields/{id}/soil`, `GET /fields/{id}/soil/summary`, `POST /fields/{id}/soil/refresh`
- [x] Soil tab with texture-by-depth stacked bar chart, color-coded legend, and interactive tooltips
- [x] Property cards: pH, Organic Carbon, CEC, Bulk Density with color-coded thresholds
- [x] AWC gauge, drainage class badge, risk indicators, data quality display
- [x] Job progress tracking for soil refresh (6-step real-time polling)
- [x] "Regional Estimate" disclaimer banner
- [x] Alembic migration `0011_add_soil_tables`
- [x] Config settings: SoilGrids WCS URL, POLARIS bucket, fetch timeout, source priority
- [x] i18n translations (English + Spanish) for all soil UI strings

---

## Future Ideas (Post-MVP)

Organized by architecture layer and ordered by dependency. Items higher in each section are prerequisites for items below.

### Layer A — Observation Infrastructure

**Completed:**
- ~~Historical data backfill~~ — ✅ Milestone 9
- ~~Soil data integration~~ — ✅ Milestone 10

**Satellite & Imagery:**
- **Multi-satellite support** — Landsat, Planet (currently Sentinel-2 only) _(prerequisite for higher-frequency monitoring)_
- **Higher-frequency monitoring** — daily revisit satellites (PlanetScope) for near real-time crop monitoring
- **Higher-res imagery** — sub-meter commercial imagery for detailed crop monitoring _(prerequisite for tree canopy analysis)_
- **Drone imagery support** — ingest and process high-res drone imagery _(depends on higher-res pipeline)_
- **Cloud masking & gap handling** — improved scene quality filtering and temporal fusion
- **Custom index builder** — user-defined indices from available bands with formula editor

**Field & Spatial:**
- **Terrain layers** — elevation, slope, aspect from SRTM/Copernicus DEM
- **Multi-model boundary detection** — ensemble approach for improved accuracy

**Sensors & External Data:**
- **Device/Sensor plugin framework** — connect soil sensors, weather stations, IoT devices
- **Machinery telemetry integration** — GPS tracks and operational data from farm equipment _(depends on plugin framework)_

### Layer B — Intelligence Engine

Each tier builds on the one above it.

**Tier 1 — Statistical analysis (CPU-only, builds on existing observations):**
- **Anomaly detection** — z-score, CUSUM, moving average deviation from historical baseline _(historical backfill ✅)_
- **Phenology tracking** — crop growth stages from NDVI/EVI temporal curves _(historical backfill ✅)_
- **Drought and water stress monitoring** — composite scoring from drought index, NDWI, soil moisture, ET₀, water balance _(extends weather + NDWI + soil)_

**Tier 2 — Composite intelligence (builds on Tier 1):**
- **Disease/pest risk signals** — risk scoring combining vegetation anomalies + weather + regional pest data _(depends on anomaly detection)_
- **Soil moisture estimation** — enhanced modeling combining remote sensing with in-situ sensor data _(depends on water stress monitoring)_
- **Soil × weather × crop interaction modeling** — nutrient buffering, salinity, compaction susceptibility _(depends on soil + weather observations)_

**Tier 3 — Actionable recommendations (builds on Tier 2):**
- **Yield forecasting** — predict from historical trends, weather, soil, and field data _(depends on phenology + anomaly detection)_
- **Harvest timing** — optimal windows from crop maturity models and vegetation indices _(depends on phenology)_
- **Fertilizer and irrigation advisory** — insights from crop health, weather forecasts, and soil data _(depends on disease risk + water stress)_

**Tier 4 — ML classification (requires GPU + fine-tuned models):**
- **Crop type detection** — multi-temporal spectral classification using foundation models _(see [research doc](docs/features/crop-tree-detection.md))_
- **Tree detection and classification** — tree crop identification and health monitoring _(depends on crop classification)_
- **Nutrient deficiency detection** — spectral signatures of common deficiencies _(depends on crop classification)_
- **Tree canopy analysis** — cover, LAI, height estimation _(depends on higher-res imagery)_

**Tier 5 — Advanced modeling (builds on all tiers):**
- **Climate impact modeling** — carbon sequestration, emissions from field data + agronomic models _(depends on yield + crop classification)_
- **Carbon/sustainability reporting** — track and report sustainability metrics _(depends on climate impact)_

### Layer C — Delivery Surfaces

**Reports & Exports:**
- **Data export** — CSV, GeoJSON, PDF formats for field data, stats, and reports
- **Seasonal summaries** — automated end-of-season reports
- **Field comparison** — side-by-side health comparison across fields
- **Historical analytics** — season-over-season trend analysis _(historical backfill ✅)_
- **Advanced analytics dashboard** — customizable dashboards, scheduled reports _(depends on field comparison)_

**API & Integrations:**
- **Versioned public API** — stable API with API keys for third-party integration _(prerequisite for MCP + webhooks)_
- **Webhook/notification system** — email, Slack, SMS on alerts _(depends on public API)_
- **Plugin system** — extensible processing pipelines for custom analysis
- **Model Context Protocol (MCP) server** — standardized interface for AI agents _(depends on public API)_
- **AI agent integration** — LLM-powered natural language insights and conversational interface _(depends on MCP)_

**Platform & Auth:**
- **Enhanced RBAC** — field-level permissions, read-only API keys, user groups
- **Email/Microsoft & Enterprise SSO** — email/password, Microsoft OAuth, SAML/OIDC
- **Advanced workflows** — rule-based automation (auto-trigger on new imagery, scheduled monitoring) _(depends on webhooks)_

**Community:**
- **Supply chain / traceability integrations** — link field data to downstream logistics and compliance
- **Community data sharing** — opt-in anonymized data for regional insights and benchmarking

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
