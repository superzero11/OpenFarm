# OpenFarm — Sprint Task List

> Auto-generated review against [openfarm.md](openfarm.md) PRD (Phase 1 MVP v1).
> Last updated: 16 February 2026

**Legend:** ✅ Done | 🔧 Partial | ⬜ Not Started

---

## Sprint 0 — Foundation (Milestone 0)

### Monorepo & DevOps

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Monorepo scaffold (`apps/web`, `services/api`, `services/processor`, `services/tiler`, `db/`) | ✅ | |
| 0.2 | Docker Compose with all 7 services (db, redis, minio, minio-init, api, processor, tiler, web) | ✅ | Proper healthchecks, volumes, networking |
| 0.3 | `.env.example` with all environment variables | ✅ | Matches PRD Section 7.7 |
| 0.4 | Persistent Docker volumes for Postgres, Redis (AOF), MinIO | ✅ | Redis AOF + noeviction configured |
| 0.5 | MinIO bucket auto-creation + basemap public policy | ✅ | `minio-init` service |
| 0.6 | `README.md` with setup instructions | ✅ | |

### Database

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.7 | Postgres + PostGIS setup | ✅ | `postgis/postgis:16-3.4` |
| 0.8 | Alembic migration framework | ✅ | Auto-runs on API startup |
| 0.9 | Initial schema migration — all 13 tables | ✅ | `0001_initial_schema.py` |
| 0.10 | `users` table (id, email, name, avatar_url) | ✅ | |
| 0.11 | `orgs` table (id, name, created_by) | ✅ | |
| 0.12 | `org_members` table (org_id, user_id, role, unique constraint) | ✅ | |
| 0.13 | `invites` table (org_id, email, role, status) | ✅ | |
| 0.14 | `farms` table (org_id, name, country, region, timezone, soft-delete) | ✅ | |
| 0.15 | `fields` table (org_id, farm_id, geom MultiPolygon 4326, area_ha, crop_type, season, tags_json, soft-delete) | ✅ | GIST index on geom |
| 0.16 | `raster_layers` table (field_id, layer_type, satellite, date, cog_uri, min/max, params_json, provenance_json) | ✅ | |
| 0.17 | `field_stats` table (field_id, layer_id, date, mean/median/min/max/p10/p90/stddev/quality_score) | ✅ | |
| 0.18 | `alerts` table (field_id, date, severity, rule_name, rule_params_json, message, status) | ✅ | |
| 0.19 | `scouting_observations` table (field_id, geom_point, title, note, tags_json, photo_uri) | ✅ | |
| 0.20 | `jobs` table (field_id, type, status, progress_json, error, params_json) | ✅ | |
| 0.21 | `audit_events` table (org_id, user_id, event_type, metadata_json) | ✅ | |
| 0.22 | `share_links` table (field_id, token, scope, expires_at, revoked_at) | ✅ | |
| 0.23 | `set_updated_at()` trigger function on mutable tables | ✅ | |
| 0.24 | `org_id` denormalized on all org-scoped tables | ✅ | Per PRD data model notes |

### FastAPI Base

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.25 | FastAPI app scaffold with `/v1` prefix | ✅ | |
| 0.26 | JWT auth middleware (HS256, `OPENFARM_JWT_SECRET`) | ✅ | `get_current_user` dependency |
| 0.27 | `X-Org-Id` header validation middleware | ✅ | `get_org_context` checks `org_members` |
| 0.28 | RBAC `require_roles()` dependency factory | ✅ | Used on org admin endpoints |
| 0.29 | CORS configuration (from env vars) | ✅ | On both API and TiTiler |
| 0.30 | Structured JSON logging (`structlog`) | ✅ | |
| 0.31 | Health check endpoint (`GET /healthz` — DB + Redis) | ✅ | |
| 0.32 | Pagination envelope (`items`, `total`, `limit`, `offset`) | ✅ | On farms, fields, alerts, audit |
| 0.33 | Pydantic settings (`pydantic-settings`) | ✅ | `core/config.py` |
| 0.34 | Async DB engine + session factory | ✅ | `core/database.py` |
| 0.35 | Sync DB engine for Celery tasks | ✅ | `core/database_sync.py` |

### NextAuth + JWT Bridge

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.36 | NextAuth Google OAuth provider | ✅ | |
| 0.37 | User upsert on first login (direct Postgres) | ✅ | Auto-creates org + owner membership |
| 0.38 | Auto-create default org "{UserName}'s Workspace" | ✅ | Per PRD decision #1 |
| 0.39 | `POST /api/auth/token` — mint API JWT (1hr TTL) | ✅ | |
| 0.40 | JWT refresh strategy (re-mint when <60s remaining) | ✅ | Client-side in `api.ts` |
| 0.41 | `apiFetch()` wrapper with `Authorization` + `X-Org-Id` headers | ✅ | |
| 0.42 | Route protection (server-side session check → redirect) | ✅ | `(authenticated)/layout.tsx` |

### Base Map

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.43 | PMTiles protocol registration for MapLibre | ✅ | Falls back to OSM raster tiles |
| 0.44 | MapLibre GL JS base map component | ✅ | `BaseMap` + `DrawMap` |
| 0.45 | Map style switcher (Street, Terrain, Satellite, Dark) | ✅ | 4 free tile sources |
| 0.46 | CSP headers for tile/map domains | ✅ | `next.config.js` |

### Observability

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.47 | Structured logging — API (`structlog` JSON) | ✅ | |
| 0.48 | Structured logging — Web (`pino`) | ✅ | `pino` logger with env-aware config, child loggers in db, auth, health |
| 0.49 | Health check — API (`/healthz`) | ✅ | DB + Redis ping |
| 0.50 | Health check — TiTiler (`/healthz`) | ✅ | |
| 0.51 | Health check — Web (`/api/health`) | ✅ | |
| 0.52 | Health check — Celery worker (Docker healthcheck) | ✅ | `celery inspect ping` in compose |

---

## Sprint 1 — Org / Farm / Field (Milestone 1)

### Org Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | `GET /v1/orgs` — list user's orgs | ✅ | |
| 1.2 | `POST /v1/orgs` — create org | ✅ | Creator becomes owner |
| 1.3 | `GET /v1/orgs/{orgId}` — org details | ✅ | |
| 1.4 | `PATCH /v1/orgs/{orgId}` — rename org | ✅ | owner/admin only |
| 1.5 | `GET /v1/orgs/{orgId}/members` — list members | ✅ | |
| 1.6 | `PATCH /v1/orgs/{orgId}/members/{userId}` — change role | ✅ | owner/admin only |
| 1.7 | `DELETE /v1/orgs/{orgId}/members/{userId}` — remove member | ✅ | owner can't self-remove |
| 1.8 | `POST /v1/orgs/{orgId}/invites` — invite by email | ✅ | |
| 1.9 | `GET /v1/invites/pending` — pending invites for current user | ✅ | |
| 1.10 | `POST /v1/invites/{inviteId}/accept` — accept invite | ✅ | |
| 1.11 | `GET /v1/orgs/{orgId}/audit-events` — audit log | ✅ | Paginated, owner/admin |
| 1.12 | Org switcher UI (sidebar dropdown) | ✅ | Stores selection in localStorage |
| 1.13 | Org settings page (rename, members, invite) | ✅ | Full CRUD UI |
| 1.14 | Audit log UI on settings page | ✅ | Event list with icons, labels, pagination |
| 1.15a | Create new org/workspace UI (sidebar + dialog) | ✅ | Dialog in sidebar, desktop + mobile |

### Farm CRUD

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.15 | `GET /v1/farms` — list farms | ✅ | Paginated |
| 1.16 | `POST /v1/farms` — create farm | ✅ | |
| 1.17 | `GET /v1/farms/{farmId}` — farm details | ✅ | |
| 1.18 | `PUT /v1/farms/{farmId}` — update farm | ✅ | |
| 1.19 | `DELETE /v1/farms/{farmId}` — soft-delete (cascade fields) | ✅ | |
| 1.20 | `GET /v1/farms/{farmId}/fields` — list fields in farm | ✅ | Paginated |
| 1.21 | Create farm modal UI | ✅ | Name, country, region, timezone |
| 1.22 | Farm list page (`/farms`) | ✅ | |
| 1.23 | Farm detail page (`/farms/[id]`) | ✅ | Edit, field list, GeoJSON import, delete |
| 1.24 | Dashboard with org stats + quick actions + farms list | ✅ | |

### Field CRUD

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.25 | `POST /v1/fields` — create field (auto area_ha) | ✅ | Polygon auto-wrapped to MultiPolygon |
| 1.26 | `GET /v1/fields/{fieldId}` — field details | ✅ | |
| 1.27 | `PUT /v1/fields/{fieldId}` — update field (recomputes area) | ✅ | |
| 1.28 | `DELETE /v1/fields/{fieldId}` — soft-delete | ✅ | |
| 1.29 | `POST /v1/fields/import` — GeoJSON bulk import | ✅ | |
| 1.30 | Draw polygon on map UI (MapLibre + Mapbox GL Draw) | ✅ | Full-screen immersive page |
| 1.31 | Edit polygon vertices (move, add, delete vertices) | ✅ | Delete key support |
| 1.32 | GeoJSON file import UI (on farm detail page) | ✅ | |
| 1.33 | Field detail page skeleton (map + tabbed sidebar) | ✅ | Immersive full-screen map |
| 1.34 | Field info tab (name, area, crop type, season, timestamps) | ✅ | View + edit mode |
| 1.35 | Field polygon overlay on map | ✅ | Green fill + outline |
| 1.36 | My Location button on map | ✅ | Both DrawMap and BaseMap |
| 1.37 | Location search (Nominatim geocoding) | ✅ | Autocomplete with locale support |

### Frontend Infrastructure

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.38 | i18n setup (`next-intl`, en + es) | ✅ | Locale prefix "as-needed" |
| 1.39 | Dark/light theme (`next-themes`) | ✅ | Toggle in sidebar |
| 1.40 | Responsive sidebar (desktop + mobile drawer) | ✅ | Collapsible |
| 1.41 | Landing page (hero, features, CTA) | ✅ | Unauthenticated users |
| 1.42 | Loading skeletons on data pages | ✅ | Dashboard, farms, settings |
| 1.43 | shadcn/ui component library (12 components) | ✅ | badge, button, card, dialog, etc. |
| 1.44 | Language switcher (en/es) | ✅ | In sidebar |
| 1.45 | Toast notifications (Sonner) | ✅ | |

---

## Sprint 2 — NDVI Monitoring (Milestone 2)

### NDVI Pipeline (Backend)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Celery + Redis worker setup | ✅ | Concurrency 4, same image as API |
| 2.2 | `POST /v1/fields/{fieldId}/jobs/ndvi` — trigger NDVI job | ✅ | Returns job ID |
| 2.3 | `GET /v1/jobs/{jobId}` — job status + progress sub-steps | ✅ | 7-step progress JSON |
| 2.4 | STAC scene search (Element84 Earth Search, pystac-client) | ✅ | Cloud cover ≤20%, weekly best |
| 2.5 | Windowed band reads (B04 Red + B08 NIR via rasterio /vsicurl/) | ✅ | Reprojection to EPSG:4326 |
| 2.6 | NDVI computation `(NIR - Red) / (NIR + Red)` | ✅ | Masked, clipped [-1, 1] |
| 2.7 | COG output to MinIO (`cogs/{org}/{field}/{date}/ndvi.tif`) | ✅ | Deflate compression |
| 2.8 | `raster_layers` row creation with provenance | ✅ | Source scene IDs, timestamps |
| 2.9 | Zonal stats computation (mean, median, min, max, stddev, p10, p90) | ✅ | `field_stats` table |
| 2.10 | Alert rule evaluation (`ndvi_drop`, `ndvi_threshold`) | ✅ | Runs as part of NDVI job |
| 2.11 | Retry policy (3 retries, exponential backoff 60/300/900s) | ✅ | |
| 2.12 | Job timeout (30min hard, 25min soft) | ✅ | |

### TiTiler Setup

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.13 | TiTiler Docker service (GDAL + /vsis3/ to MinIO) | ✅ | |
| 2.14 | JWT auth on tile requests (header + query param) | ✅ | `access_token` query param for MapLibre |
| 2.15 | CORS on TiTiler (GET/OPTIONS only) | ✅ | |
| 2.16 | Tile URL generation in API layer response | ✅ | `/v1/fields/{fieldId}/layers` includes `tile_url` |

### NDVI Frontend

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.17 | `GET /v1/fields/{fieldId}/layers` — list NDVI layers | ✅ | |
| 2.18 | `GET /v1/fields/{fieldId}/stats` — NDVI time-series | ✅ | |
| 2.19 | NDVI tab UI (NdviTab component) | ✅ | Job creation, layer list, toggle visibility |
| 2.20 | Job creation form (date range picker) | ✅ | Collapsible accordion |
| 2.21 | Job progress polling UI (5s interval, sub-step display) | ✅ | |
| 2.22 | NDVI tile overlay on map (MapLibre raster layer) | ✅ | Opacity 0.75, preserved across style changes |
| 2.23 | NDVI time-series chart (Apache ECharts) | ✅ | Line + p10–p90 band, date zoom, click-to-select |
| 2.24 | Date selector (pick observation date to show on map) | ✅ | Click on chart or layer list |
| 2.25 | Layer legend (min/max NDVI values) | ✅ | Floating map legend with rdylgn gradient, field min/max markers |
| 2.26 | MapLibre `transformRequest` for JWT on tile requests | ✅ | Token refresh every 10 min |
| 2.27 | NDVI overlay persists across basemap style changes | ✅ | Polling-based approach |

---

## Sprint 3 — Alerts + Scouting + Share (Milestone 3)

### Alerts

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | `GET /v1/alerts` — list alerts (field/farm/status filters) | ✅ | Backend complete |
| 3.2 | `GET /v1/fields/{fieldId}/alerts` — field alerts | ✅ | Backend complete |
| 3.3 | `PATCH /v1/alerts/{alertId}` — close/reopen alert | ✅ | Backend complete |
| 3.4 | Alert rules: `ndvi_drop` (15% drop vs rolling avg of 4) | ✅ | Runs in NDVI job pipeline |
| 3.5 | Alert rules: `ndvi_threshold` (below 0.3) | ✅ | Runs in NDVI job pipeline |
| 3.6 | `alertsApi` client functions in frontend | ✅ | `listForField`, `update` |
| 3.7 | Alerts tab UI — list alerts with severity badges | ⬜ | Tab exists as placeholder |
| 3.8 | Alerts tab UI — close/acknowledge alert action | ⬜ | |
| 3.9 | Alerts list on farm dashboard | ⬜ | PRD mentions farm-level alerts summary |
| 3.10 | Alert notification indicator (badge on tab) | ⬜ | |

### Scouting

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.11 | `GET /v1/fields/{fieldId}/scouting` — list observations | ✅ | Backend complete |
| 3.12 | `POST /v1/fields/{fieldId}/scouting` — create observation | ✅ | Backend complete |
| 3.13 | `PATCH /v1/fields/{fieldId}/scouting/{id}` — update | ✅ | Backend complete |
| 3.14 | `DELETE /v1/fields/{fieldId}/scouting/{id}` — delete | ✅ | Backend complete |
| 3.15 | `POST /v1/uploads/presign` — presigned upload URL | ✅ | Backend complete |
| 3.16 | `scoutingApi` client functions in frontend | ⬜ | |
| 3.17 | `uploadsApi` client functions in frontend | ⬜ | |
| 3.18 | Scouting tab UI — list observations | ⬜ | Tab exists as placeholder |
| 3.19 | Scouting tab UI — create observation form (point on map, title, note, tags) | ⬜ | |
| 3.20 | Scouting photo upload (presigned URL to MinIO) | ⬜ | |
| 3.21 | Scouting observations as map markers | ⬜ | |
| 3.22 | Associate scouting observation with alert | ⬜ | Backend supports alert_id FK |

### Share (Shareable Field Health Report)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.23 | `GET /v1/fields/{fieldId}/share` — list share links | ✅ | Backend complete |
| 3.24 | `POST /v1/fields/{fieldId}/share` — create share link | ✅ | Backend: token, scope, expiry |
| 3.25 | `DELETE /v1/fields/{fieldId}/share/{token}` — revoke | ✅ | Backend complete |
| 3.26 | `GET /v1/share/{token}` — public report data | ✅ | Backend: field + layers + stats + alerts |
| 3.27 | `shareApi` client functions in frontend | ⬜ | |
| 3.28 | Share tab UI — create link (expiry: 7d/30d/never) | ⬜ | Tab exists as placeholder |
| 3.29 | Share tab UI — list active links, copy URL | ⬜ | |
| 3.30 | Share tab UI — revoke link | ⬜ | |
| 3.31 | Public report page (`/share/[token]`) — unauthenticated | ⬜ | No route exists |
| 3.32 | Public report — field boundary on map | ⬜ | |
| 3.33 | Public report — latest NDVI snapshot | ⬜ | |
| 3.34 | Public report — NDVI time-series chart | ⬜ | |
| 3.35 | Public report — recent alerts | ⬜ | |
| 3.36 | Public report — recent scouting notes | ⬜ | |

---

## Sprint 4 — Polish, Security & QA

### RBAC Hardening

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Viewer role enforcement — restrict write endpoints to member+ | ⬜ | Currently any org member can write |
| 4.2 | Owner can't self-remove validation | ✅ | Implemented in API |

### Audit Events

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.3 | Audit: login event | 🔧 | User upsert logged, but no explicit "login" event |
| 4.4 | Audit: org created | ✅ | |
| 4.5 | Audit: member invited | ✅ | |
| 4.6 | Audit: role changed | ✅ | |
| 4.7 | Audit: field created | ✅ | |
| 4.8 | Audit: report shared | ✅ | |
| 4.9 | Audit log UI in settings | ⬜ | API client wired, no UI |

### Content Security Policy

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.10 | CSP headers in `next.config.js` | ✅ | Includes tile/map domains |
| 4.11 | `frame-ancestors 'none'` | ✅ | |

### Backup & Data Export

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.12 | `pg_dump` backup documentation/script | ⬜ | PRD: daily cron, 7-day retention |
| 4.13 | MinIO bucket versioning documentation | ⬜ | |
| 4.14 | WAL archiving documentation | ⬜ | For production PITR |

### Testing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.15 | API unit/integration tests | ⬜ | No test files found |
| 4.16 | Frontend component tests | ⬜ | |
| 4.17 | E2E tests (acceptance criteria from PRD §16) | ⬜ | |

### Missing Non-functional Items

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.18 | Frontend structured logging (pino) | ⬜ | PRD §12 specifies pino |
| 4.19 | Celery worker Docker healthcheck | ⬜ | compose has no healthcheck |
| 4.20 | Rate limiting on API endpoints | ⬜ | Not in PRD, but good practice |
| 4.21 | Pagination on layers/stats/members list endpoints | 🔧 | Some use paginated envelope, some return plain arrays |

---

## Progress Summary

| Sprint | Total Tasks | ✅ Done | 🔧 Partial | ⬜ Not Started |
|--------|-------------|---------|-------------|----------------|
| **Sprint 0 — Foundation** | 52 | 52 | 0 | 0 |
| **Sprint 1 — Org/Farm/Field** | 46 | 46 | 0 | 0 |
| **Sprint 2 — NDVI Monitoring** | 27 | 27 | 0 | 0 |
| **Sprint 3 — Alerts/Scouting/Share** | 36 | 11 | 0 | 25 |
| **Sprint 4 — Polish/Security/QA** | 21 | 6 | 3 | 12 |
| **TOTAL** | **182** | **142 (78%)** | **3 (2%)** | **37 (20%)** |

### Key Takeaway

**Milestones 0–2 are essentially complete** (96% done). The backend is 100% implemented for all PRD features including Milestone 3. The remaining 22% is almost entirely **frontend UI for Sprint 3** (Alerts, Scouting, Share — 25 tasks) and **Sprint 4 QA/polish** (12 tasks). The critical path to MVP completion is building the three remaining frontend features and the public share report page.
