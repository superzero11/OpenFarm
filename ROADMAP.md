# Roadmap

> Last updated: March 2026

This document outlines where OpenFarm is today and where it's headed. If you'd like to contribute to any of these areas, check the [Contributing Guide](CONTRIBUTING.md) and look for issues labeled [`help wanted`](https://github.com/superzero11/OpenFarm/labels/help%20wanted) or [`good first issue`](https://github.com/superzero11/OpenFarm/labels/good%20first%20issue).

---

## Current Status

OpenFarm **Phase 3 (Boundary Detection) is complete**. The platform delivers end-to-end satellite-powered crop intelligence with four vegetation indices (NDVI, EVI, SAVI, NDWI), ML-powered automatic field boundary detection, auth, org management, farm/field CRUD, configurable monitoring pipelines, per-index alerts, scouting observations, shareable field health reports, and production-grade security hardening — all functional and deployed. The focus now shifts to testing, documentation, and expanding the platform with new data sources and intelligence capabilities. See [Future Ideas](#future-ideas-post-mvp) for what's next.

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

---

## Future Ideas (Post-MVP)

These are under consideration but not yet committed. Grouped by theme and roughly ordered by priority.

### Platform Foundations
- **Email/Microsoft & Enterprise SSO** — support email/password, Microsoft OAuth, and SAML/OIDC for enterprise identity providers
- **Direct API integration** — stable, versioned public API with API keys for integrating OpenFarm into existing farm management software
- **Multi-satellite support** — Landsat, Planet (currently Sentinel-2 only)
- **Higher-frequency monitoring** — support for daily revisit satellites (e.g., PlanetScope) for near real-time crop monitoring
- **Higher-res imagery** — support for sub-meter commercial imagery for detailed crop monitoring
- **Custom index builder** — UI for users to define custom indices from available bands with formula editor and visualization
- **Data export** — export field data, stats, and reports in CSV, GeoJSON, PDF formats
- **User roles and permissions** — more granular permissions (e.g., field-level access, read-only API keys) and user groups


### Agricultural Intelligence
- **Weather data integration** — overlay forecasts and historical weather on field maps and incorporate into alert rules
- **Crop detection and classification** — ML-based crop type identification from spectral data
- **tree detection and classification** — ML-based tree crop identification and health monitoring
- **Phenology tracking** — track crop growth stages and phenological events from satellite data
- **tree canopy analysis** — canopy cover, leaf area index, and tree height estimation from high-res imagery
- **drought monitoring** — integrate drought indices and soil moisture data for water stress assessment
- **water stress monitoring** — integrate NDWI and soil moisture data for irrigation management
- **soil moisture estimation** — integrate soil moisture data from remote sensing and in-situ sensors
- **Disease/pest risk signals** — risk scoring framework combining vegetation anomalies, weather, and regional pest data
- **nutrient deficiency detection** — identify spectral signatures of common nutrient deficiencies for early intervention
- **Fertilizer and irrigation recommendations** — actionable insights based on crop health trends, weather forecasts, and agronomic models
- **Anomaly detection** — unsupervised ML to identify unusual patterns in field health data that may indicate emerging issues 
- **Historical data backfill** — backfill historical vegetation index data for existing fields to enable trend analysis from day one
- **Yield analysis and forecasting** — predict yield from historical NDVI trends, weather, and field data
- **Harvest timing recommendations** — optimal harvest windows based on crop maturity models and vegetation indices
- **Climate impact modeling** — estimate carbon sequestration, emissions, and climate impact of farming practices using field data and agronomic models
- **Carbon/sustainability reporting** — track and report carbon sequestration, emissions, and sustainability metrics

### Analytics & Workflows
- **Advanced analytics and reporting framework** — customizable dashboards, scheduled reports, and data export
- **Field comparison** — side-by-side health comparison across fields
- **Historical analytics** — season-over-season trend analysis
- **Advanced workflows** — rule-based automation (e.g., auto-trigger analysis on new imagery, scheduled monitoring)
- **Webhook/notification system** — email, Slack, or SMS on alerts

### Ecosystem & Integrations
- **AI agent integration** — connect to LLMs for natural language insights, recommendations, and conversational interfaces  
- **Model Context Protocol (MCP) server** — standardized interface for AI agents to query field data and trigger analysis
- **Device/Sensor plugin framework** — connect soil sensors, weather stations, and IoT devices
- **Machinery telemetry integration** — ingest GPS tracks and operational data from farm equipment
- **Supply chain / traceability integrations** — link field data to downstream logistics and compliance systems
- **Plugin system** — extensible processing pipelines for custom analysis
- **Community data sharing** — opt-in anonymized data sharing for regional insights and benchmarking

### Enterprise & Scale
- **Enterprise admin controls** — SSO enforcement, audit policies, usage quotas, multi-tenant admin
- **Custom analytics packs per vertical** — tailored modules for tree crops, forestry, viticulture, etc.
- **Modular ERP** — lightweight farm operations management (inventory, tasks, financials)
- **Mobile app** — React Native companion for field scouting
- **Hosted offering** — managed cloud version

---

## How to Contribute

The MVP is complete! The highest-impact contributions right now are:

1. **Automated tests** — API integration tests, frontend component tests, and E2E acceptance tests (Milestone 4 remaining items)
2. **Future Ideas** — pick any item from the list above or browse [open issues](https://github.com/superzero11/OpenFarm/issues)

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.
