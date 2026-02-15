# Roadmap

> Last updated: February 2026

This document outlines where OpenFarm is today and where it's headed. If you'd like to contribute to any of these areas, check the [Contributing Guide](CONTRIBUTING.md) and look for issues labeled [`help wanted`](https://github.com/superzero11/OpenFarm/labels/help%20wanted) or [`good first issue`](https://github.com/superzero11/OpenFarm/labels/good%20first%20issue).

---

## Current Status

OpenFarm is in **early alpha**. The core platform (auth, org management, farm/field CRUD, and NDVI monitoring pipeline) is functional end-to-end.

---

## Milestone 0 — Foundation ✅

- [x] Monorepo structure (`apps/web`, `services/api`, `services/tiler`)
- [x] Docker Compose with all services (Postgres/PostGIS, Redis, MinIO, API, Celery, TiTiler, Web)
- [x] Database schema — all 13 tables with UUID PKs, PostGIS geometry, soft-delete
- [x] JWT auth (NextAuth Google OAuth → shared HS256 JWT bridge)
- [x] RBAC system (`owner` / `admin` / `member` / `viewer`)
- [x] MapLibre base map with PMTiles + 4 style options
- [x] Health checks across all services
- [x] Structured logging (structlog)
- [x] CI pipeline (ESLint, TypeScript, ruff)

## Milestone 1 — Org, Farm & Field Management ✅

- [x] Org CRUD — create, rename, member management, invites, audit log
- [x] Farm CRUD — create, edit, soft-delete, list with pagination
- [x] Field CRUD — draw polygon on map, edit vertices, GeoJSON/KML import
- [x] Auto area calculation (hectares, geodesic)
- [x] Dashboard with org stats and quick actions
- [x] i18n support (English + Spanish)
- [x] Dark/light theme, responsive sidebar
- [x] Landing page for unauthenticated users

## Milestone 2 — NDVI Monitoring ✅

- [x] NDVI pipeline: STAC search → band download → NDVI computation → COG → MinIO
- [x] Zonal statistics (mean, median, min, max, stddev, p10, p90)
- [x] TiTiler tile serving with JWT auth
- [x] NDVI tile overlay on map
- [x] Time-series chart (Apache ECharts) with percentile bands
- [x] Alert rules: `ndvi_drop` (15% drop) and `ndvi_threshold` (below 0.3)
- [x] Job progress tracking with 7-step sub-status

## Milestone 3 — Alerts, Scouting & Sharing 🔧 In Progress

Backend APIs are complete. Frontend UI is the remaining work.

- [x] Alerts API (list, filter by field/farm/status, close/reopen)
- [ ] **Alerts UI** — list alerts with severity badges, close/acknowledge actions
- [ ] **Alerts on farm dashboard** — summary of active alerts across fields
- [x] Scouting API (CRUD observations with geotagged points, photo upload via presigned URLs)
- [ ] **Scouting UI** — create/list observations, pin on map, photo upload
- [x] Share API (create/revoke share links with expiry, public report endpoint)
- [ ] **Share UI** — create link, copy URL, manage active links
- [ ] **Public report page** (`/share/[token]`) — map, NDVI snapshot, time-series chart, alerts, scouting notes

## Milestone 4 — Polish, Security & QA ⬜ Planned

- [ ] Viewer role enforcement (read-only for viewer members)
- [ ] Audit log UI in settings page
- [ ] Floating NDVI legend on map
- [ ] Pagination consistency across all list endpoints
- [ ] Frontend structured logging (pino)
- [ ] Celery worker health check in Docker Compose
- [ ] Backup/restore documentation (pg_dump, MinIO versioning)
- [ ] API unit/integration tests
- [ ] Frontend component tests
- [ ] E2E acceptance tests

---

## Future Ideas (Post-MVP)

These are under consideration but not yet committed. Grouped by theme and roughly ordered by priority.

### Platform Foundations
- **Email/Microsoft & Enterprise SSO** — support email/password, Microsoft OAuth, and SAML/OIDC for enterprise identity providers
- **Direct API integration** — stable, versioned public API with API keys for integrating OpenFarm into existing farm management software
- **Boundary detection** — automatic field boundary detection from satellite imagery
- **Crop detection and classification** — ML-based crop type identification from spectral data
- **Additional vegetation indices** — EVI, SAVI, NDWI alongside NDVI
- **Multi-satellite support** — Landsat, Planet (currently Sentinel-2 only)

### Agricultural Intelligence
- **Disease/pest risk signals** — risk scoring framework combining vegetation anomalies, weather, and regional pest data
- **Yield analysis and forecasting** — predict yield from historical NDVI trends, weather, and field data
- **Weather data integration** — overlay forecasts and historical weather on field maps
- **Carbon/sustainability reporting** — track and report carbon sequestration, emissions, and sustainability metrics

### Analytics & Workflows
- **Advanced analytics and reporting framework** — customizable dashboards, scheduled reports, and data export
- **Field comparison** — side-by-side health comparison across fields
- **Historical analytics** — season-over-season trend analysis
- **Advanced workflows** — rule-based automation (e.g., auto-trigger NDVI on new imagery, scheduled monitoring)
- **Webhook/notification system** — email, Slack, or SMS on alerts

### Ecosystem & Integrations
- **OpenFarm MCP server** — Model Context Protocol server for AI agent integration
- **Device/Sensor plugin framework** — connect soil sensors, weather stations, and IoT devices
- **Machinery telemetry integration** — ingest GPS tracks and operational data from farm equipment
- **Supply chain / traceability integrations** — link field data to downstream logistics and compliance systems
- **Plugin system** — extensible processing pipelines for custom analysis

### Enterprise & Scale
- **Enterprise admin controls** — SSO enforcement, audit policies, usage quotas, multi-tenant admin
- **Custom analytics packs per vertical** — tailored modules for tree crops, forestry, viticulture, etc.
- **Modular ERP** — lightweight farm operations management (inventory, tasks, financials)
- **Mobile app** — React Native companion for field scouting
- **Hosted offering** — managed cloud version

---

## How to Contribute

Pick any unchecked item above, or browse [open issues](https://github.com/superzero11/OpenFarm/issues). Milestone 3 frontend tasks are the highest-impact contributions right now.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.
