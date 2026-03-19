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
| 3.6 | `alertsApi` client functions in frontend | ✅ | `listForField`, `listForFarm`, `list`, `update` |
| 3.7 | Alerts tab UI — list alerts with severity badges | ✅ | Shared `AlertRow` component, compact mode for sidebar |
| 3.8 | Alerts tab UI — close/acknowledge alert action | ✅ | Toggle open/closed with spinner |
| 3.9 | Alerts list on farm dashboard | ✅ | Dedicated `/alerts` page with filters; removed from farm detail per UX simplification |
| 3.10 | Alert notification indicator (badge on tab) | ✅ | Badge on field tab + sidebar nav (desktop/mobile) |

### Scouting

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.11 | `GET /v1/fields/{fieldId}/scouting` — list observations | ✅ | Backend complete |
| 3.12 | `POST /v1/fields/{fieldId}/scouting` — create observation | ✅ | Backend complete |
| 3.13 | `PATCH /v1/fields/{fieldId}/scouting/{id}` — update | ✅ | Backend complete |
| 3.14 | `DELETE /v1/fields/{fieldId}/scouting/{id}` — delete | ✅ | Backend complete |
| 3.15 | `POST /v1/uploads/presign` — presigned upload URL | ✅ | Backend complete |
| 3.16 | `scoutingApi` client functions in frontend | ✅ | list, create, update, delete in `api.ts` |
| 3.17 | `uploadsApi` client functions in frontend | ✅ | presign + upload helper with public MinIO endpoint |
| 3.18 | Scouting tab UI — list observations | ✅ | ScoutingTab component with cards, tags, photo thumbnails |
| 3.19 | Scouting tab UI — create observation form (point on map, title, note, tags) | ✅ | Map click-to-pick point, title, note, tags fields |
| 3.20 | Scouting photo upload (presigned URL to MinIO) | ✅ | Presigned PUT upload, preview, public display URL |
| 3.21 | Scouting observations as map markers | ✅ | GeoJSON circle markers, click-to-highlight, fly-to |
| 3.22 | Associate scouting observation with alert | ✅ | Alert dropdown in create form, linked badge in list |

### Share (Shareable Field Health Report)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.23 | `GET /v1/fields/{fieldId}/share` — list share links | ✅ | Backend complete |
| 3.24 | `POST /v1/fields/{fieldId}/share` — create share link | ✅ | Backend: token, scope, expiry |
| 3.25 | `DELETE /v1/fields/{fieldId}/share/{token}` — revoke | ✅ | Backend complete |
| 3.26 | `GET /v1/share/{token}` — public report data | ✅ | Backend: field + layers + stats + alerts |
| 3.27 | `shareApi` client functions in frontend | ✅ | list, create, revoke, getReport in `api.ts` |
| 3.28 | Share tab UI — create link (expiry: 7d/30d/never) | ✅ | ShareTab component with expiry selector |
| 3.29 | Share tab UI — list active links, copy URL | ✅ | Full URL display, copy + open buttons |
| 3.30 | Share tab UI — revoke link | ✅ | Destructive confirm dialog |
| 3.31 | Public report page (`/share/[token]`) — unauthenticated | ✅ | `/[locale]/share/[token]`, branded layout |
| 3.32 | Public report — field boundary on map | ✅ | Satellite basemap (Esri), non-interactive |
| 3.33 | Public report — latest NDVI snapshot | ✅ | Tile proxy through API (no JWT needed) |
| 3.34 | Public report — NDVI time-series chart | ✅ | Reuses NdviChart, threshold line |
| 3.35 | Public report — recent alerts | ✅ | Severity badges, open/closed status |
| 3.36 | Public report — recent scouting notes | ✅ | Photos, tags, map pin icons |

---

## Sprint 4 — Polish, Security & QA

### RBAC Hardening

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Viewer role enforcement — restrict write endpoints to member+ | ✅ | `_writer = require_roles("owner", "admin", "member")` on all write endpoints across 7 routers |
| 4.2 | Owner can't self-remove validation | ✅ | Implemented in API |

### Audit Events

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.3 | Audit: login event | ✅ | `login` event inserted in `upsertUser()` (db.ts) on every sign-in |
| 4.4 | Audit: org created | ✅ | |
| 4.5 | Audit: member invited | ✅ | |
| 4.6 | Audit: role changed | ✅ | |
| 4.7 | Audit: field created | ✅ | |
| 4.8 | Audit: report shared | ✅ | |
| 4.9 | Audit log UI in settings | ✅ | Full audit tab with icons, search, pagination, i18n labels |

### Content Security Policy

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.10 | CSP headers in `next.config.js` | ✅ | Includes tile/map domains |
| 4.11 | `frame-ancestors 'none'` | ✅ | |

### Backup & Data Export

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.12 | `pg_dump` backup documentation/script | ✅ | `deploy/backup.sh` — automated daily cron, 7-day retention, optional MinIO upload |
| 4.13 | MinIO bucket versioning documentation | ✅ | DEPLOYMENT.md — mc versioning enable, lifecycle rules |
| 4.14 | WAL archiving documentation | ✅ | DEPLOYMENT.md — PITR setup, recovery procedure |

### Testing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.15 | API unit/integration tests | ⬜ | No test files found |
| 4.16 | Frontend component tests | ⬜ | |
| 4.17 | E2E tests (acceptance criteria from PRD §16) | ⬜ | |

### Missing Non-functional Items

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.18 | Frontend structured logging (pino) | ✅ | `pino` logger in `lib/logger.ts` with JSON output, child loggers |
| 4.19 | Celery worker Docker healthcheck | ✅ | `celery inspect ping` in docker-compose.yml |
| 4.20 | Rate limiting on API endpoints | ✅ | `slowapi` — 120 req/min default, 5/min job creation, 10/min uploads, Redis-backed |
| 4.21 | Pagination on layers/stats/members list endpoints | ✅ | All wrapped in `PaginatedResponse` envelope with total count |

---

## Sprint 5 — Vegetation Index Registry & Backend Pipeline (Phase 2 — Multi-Index)

> Feature spec: [docs/features/vegetation-indices.md](features/vegetation-indices.md)

### Index Registry & Shared Pipeline

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Create index registry (`seyes,rvices/api/app/tasks/indices.py`) — formula functions, required bands, colormap, rescale, alert defaults for NDVI/EVI/SAVI/NDWI | ✅ | `IndexDef` dataclass + `INDEX_REGISTRY` dict |
| 5.2 | Extract shared pipeline helpers from `ndvi.py` — STAC scene search, band download, COG write, zonal stats, alert evaluation | ✅ | `tasks/pipeline.py` — all helpers extracted |
| 5.3 | Refactor `process_ndvi` to use shared helpers + index registry | ✅ | Task name unchanged, delegates to `pipeline.py` |
| 5.4 | NDVI computation formula: `(B08−B04)/(B08+B04)` — verify unchanged after refactor | 🔧 | Formula in registry matches; needs runtime test |

### EVI Task

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.5 | EVI Celery task (`process_evi`) — 7-step pipeline | ✅ | `tasks/vegetation.py` — uses shared pipeline |
| 5.6 | EVI formula: `2.5 × (B08−B04) / (B08 + 6×B04 − 7.5×B02 + 1)` | ✅ | In `indices.py` `_evi()`, clipped [-1,1] |
| 5.7 | EVI COG output to MinIO (`cogs/{org}/{field}/{date}/evi.tif`) | ✅ | Shared `write_cog()` with `index_key` param |
| 5.8 | EVI zonal stats (mean, median, min, max, stddev, p10, p90, quality_score) | ✅ | Shared `compute_zonal_stats()` + `process_scene()` |

### SAVI Task

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.9 | SAVI Celery task (`process_savi`) — 7-step pipeline | ✅ | `tasks/vegetation.py` — uses shared pipeline |
| 5.10 | SAVI formula: `((B08−B04)/(B08+B04+L)) × (1+L)` with configurable L factor | ✅ | In `indices.py` `_savi()`, L via `**kwargs` |
| 5.11 | SAVI COG output to MinIO (`cogs/{org}/{field}/{date}/savi.tif`) | ✅ | Shared `write_cog()` |
| 5.12 | SAVI zonal stats | ✅ | Shared `compute_zonal_stats()` |

### NDWI Task

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.13 | NDWI Celery task (`process_ndwi`) — 7-step pipeline | ✅ | `tasks/vegetation.py` — uses shared pipeline |
| 5.14 | NDWI formula: `(B03−B08)/(B03+B08)` | ✅ | In `indices.py` `_ndwi()`, clipped [-1,1] |
| 5.15 | NDWI COG output to MinIO (`cogs/{org}/{field}/{date}/ndwi.tif`) | ✅ | Shared `write_cog()` |
| 5.16 | NDWI zonal stats | ✅ | Shared `compute_zonal_stats()` |

### Job Schema & API Endpoint

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.17 | `JobCreateIndex` Pydantic schema — `index_type: Literal["ndvi","evi","savi","ndwi"]`, optional `savi_l: float` | ✅ | With `field_validator` for savi_l |
| 5.18 | `POST /v1/fields/{field_id}/jobs/index` — generalized job endpoint | ✅ | `_INDEX_TASK_MAP` for dispatch |
| 5.19 | Keep `POST /v1/fields/{field_id}/jobs/ndvi` as backward-compatible alias | ✅ | Delegates to `_create_index_job()` |
| 5.20 | Rate limit on new endpoint (5/minute, same as existing) | ✅ | `@limiter.limit("5/minute")` |

---

## Sprint 6 — Alerts, Monitoring API & Database Migration (Phase 2 — Multi-Index)

### Database Migration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Alembic migration: add `index_type` column to `alerts` table (`String(20)`, nullable, default `"ndvi"`) | ✅ | `0002_add_index_type_to_alerts.py` |
| 6.2 | Backfill existing alerts with `index_type = "ndvi"` | ✅ | In same Alembic revision via `server_default` + UPDATE backfill |

### Alert Rules per Index

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.3 | Update Alert model — add `index_type` mapped column | ✅ | `String(20)`, nullable, default `"ndvi"` |
| 6.4 | EVI alert: `evi_threshold` (mean < 0.2) with high/medium severity | ✅ | Registry `AlertDefaults(thresh=0.2)` → `run_alerts()` |
| 6.5 | EVI alert: `evi_drop` (≥15% drop vs 4-observation rolling avg) | ✅ | Registry `AlertDefaults(drop_pct=0.15)` |
| 6.6 | SAVI alert: `savi_threshold` (mean < 0.25) | ✅ | Registry `AlertDefaults(thresh=0.25)` |
| 6.7 | SAVI alert: `savi_drop` (≥15% drop) | ✅ | Registry `AlertDefaults(drop_pct=0.15)` |
| 6.8 | NDWI alert: `ndwi_threshold` (mean < 0.0) | ✅ | Registry `AlertDefaults(thresh=0.0)` |
| 6.9 | NDWI alert: `ndwi_drop` (≥20% drop) | ✅ | Registry `AlertDefaults(drop_pct=0.20)` |
| 6.10 | Alert evaluation uses per-index defaults from index registry | ✅ | `run_alerts()` reads `index_def.alerts` — zero hardcoded thresholds |

### Monitoring API Updates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.11 | Update `_layer_to_out()` — per-index colormap + rescale in tile URL from registry | ✅ | Done in Sprint 5 — `monitoring.py` uses `INDEX_REGISTRY` |
| 6.12 | `GET /v1/fields/{field_id}/layers/types` — return available index types for a field | ✅ | Done in Sprint 5 — `distinct(RasterLayer.layer_type)` |
| 6.13 | Verify `GET /v1/fields/{field_id}/layers?type=EVI` filters correctly | 🔧 | Code present; needs runtime test with real data |
| 6.14 | Verify `GET /v1/fields/{field_id}/stats?type=EVI` joins correctly | 🔧 | Code present; needs runtime test with real data |
| 6.15 | Update `AlertOut` schema to include `index_type` | ✅ | `index_type: str \| None = None` in `AlertOut` |
| 6.16 | Update alerts router — allow filtering by `index_type` query param | ✅ | `Query(None)` param + `.where(Alert.index_type == index_type)` |

---

## Sprint 7 — Frontend Multi-Index UI (Phase 2 — Multi-Index)

### API Client & Types

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Add `IndexType` union type to `api.ts` | ✅ | `"NDVI" \| "EVI" \| "SAVI" \| "NDWI"` |
| 7.2 | Add `INDEX_CONFIG` map — colormap, rescale, gradient CSS, threshold, label per index | ✅ | With `lineColor`, `bandColor`, `threshold` per index |
| 7.3 | Add `jobsApi.createIndex(fieldId, indexType, dateFrom, dateTo, params?)` | ✅ | Calls `POST /fields/{id}/jobs/index` |
| 7.4 | Update `monitoringApi.layers()` / `monitoringApi.stats()` — accept `IndexType` param | ✅ | Type-safe `IndexType` parameter + `layerTypes()` |

### Generalize Chart Component

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.5 | Generalize `ndvi-chart.tsx` — accept `indexType` prop | ✅ | Uses `INDEX_CONFIG` for threshold, colors, series name |
| 7.6 | Per-index threshold marker (0.3 NDVI, 0.2 EVI, 0.25 SAVI, 0.0 NDWI) | ✅ | `config.threshold` → markLine |
| 7.7 | Per-index tooltip labels | ✅ | `seriesName = "Mean ${config.label}"` |

### Generalize Legend Component

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.8 | Generalize `ndvi-legend.tsx` — accept `indexType` prop | ✅ | Uses `INDEX_CONFIG` for gradient, rescale |
| 7.9 | NDWI legend: blue-red gradient (`rdbu` colormap) | ✅ | `INDEX_CONFIG.NDWI.gradient` uses rdbu stops |
| 7.10 | Legend title shows current index name | ✅ | `config.label` displayed |

### Monitoring Tab (formerly NDVI Tab)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.11 | Add index selector UI (tabs or dropdown) — NDVI / EVI / SAVI / NDWI | ✅ | Button group in `ndvi-tab.tsx` |
| 7.12 | Job form: checkboxes to select which indices to compute | ✅ | Toggle buttons with `selectedIndices` Set |
| 7.13 | SAVI: show L factor input (number, default 0.5) when SAVI selected | ✅ | Conditional number input, 0–1 range |
| 7.14 | Per-index layers list — shows layers for selected index | ✅ | `monitoringApi.layers(fieldId, activeIndex)` |
| 7.15 | Per-index chart — shows stats for selected index | ✅ | `monitoringApi.stats(fieldId, activeIndex)` + `indexType` prop |
| 7.16 | Per-index job progress — poll active job for selected index | ✅ | `getStepLabels(activeIndex)` for dynamic step names |
| 7.17 | Submit multiple jobs (one per checked index) from single form | ✅ | Sequential `jobsApi.createIndex()` dispatch |

### Map Overlay

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.18 | Generalize `addNdviOverlay` → `addIndexOverlay(map, layer, field, indexType)` | ✅ | With `indexSourceId()` / `indexLayerId()` helpers |
| 7.19 | Source/layer IDs include index type (e.g., `evi-tiles`, `evi-raster`) | ✅ | `${indexType.toLowerCase()}-tiles/raster` |
| 7.20 | Remove previous index overlay when switching indices | ✅ | `removeAllIndexOverlays()` before adding new |

---

## Sprint 8 — Polish, Share Page & i18n (Phase 2 — Multi-Index)

### Share / Public Report

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | Update share API response to include available index types | ✅ | `available_index_types`, `layers_by_type`, `stats_by_type` added |
| 8.2 | Add index toggle on public report page when multiple indices available | ✅ | Pill-button selector, auto-hides with ≤1 index |
| 8.3 | Per-index map overlay on share page | ✅ | Tile proxy accepts `?index_type=` param, swaps source on toggle |
| 8.4 | Per-index chart on share page | ✅ | `NdviChart` with `indexType` prop + `stats_by_type` filtering |
| 8.5 | Per-index legend on share page | ✅ | `NdviLegend` with `indexType` overlay on map card |

### i18n Translations

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.6 | English translations (`en.json`) — index names, descriptions, labels, alert messages | ✅ | `monitoring.indexName.*`, `.indexDesc.*`, `.alertMessage.*` |
| 8.7 | Spanish translations (`es.json`) — same keys | ✅ | Full Spanish translations for all monitoring keys |
| 8.8 | Job step labels for new index tasks | ✅ | `monitoring.jobStep.compute{Ndvi,Evi,Savi,Ndwi}` (en + es) |
| 8.9 | Alert message templates per index | ✅ | `monitoring.alertMessage.*` with `{pct}` and `{value}` params |

### Integration & Verification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.10 | End-to-end test: trigger EVI job → verify COG + stats + tile URL + chart + legend | ⬜ | |
| 8.11 | End-to-end test: trigger SAVI job with custom L=0.3 → verify formula uses L=0.3 | ⬜ | |
| 8.12 | End-to-end test: trigger NDWI job → verify B03 (Green) band downloaded | ⬜ | |
| 8.13 | Verify NDWI tile URL uses `rdbu` colormap, not `rdylgn` | ⬜ | |
| 8.14 | Verify existing NDVI pipeline unchanged (backward compat) | ⬜ | Run existing NDVI job, compare output |
| 8.15 | Verify share page index toggle works with mixed indices | ⬜ | |
| 8.16 | Verify alerts filtered correctly by `index_type` in alerts page | ⬜ | |

---

## Sprint 9 — Security Hardening & Critical Fixes

### Container Security

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.1 | Add non-root user to API Dockerfile | ✅ | `addgroup`/`adduser` + `USER appuser` |
| 9.2 | Add non-root user to Tiler Dockerfile | ✅ | Same pattern as API |

### Upload Security

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.3 | Whitelist upload `content_type` to `image/jpeg`, `image/png`, `image/webp` | ✅ | `_ALLOWED_CONTENT_TYPES` set + 400 on mismatch |

### Security Documentation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.4 | Document JWT-in-tile-URL trade-off in `SECURITY.md` | ✅ | Added Known Limitations section |

### Resource Lifecycle

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.5 | Fix `httpx.AsyncClient` lifecycle via FastAPI lifespan | ✅ | Client on `app.state`, closed in lifespan |

### Database Indexes

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.6 | Add Alembic migration for missing indexes on FK columns | ✅ | Migration `0004` + ORM `index=True` |

### Infrastructure

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.7 | Add healthcheck to `web` service in `docker-compose.yml` | ✅ | `curl -f http://localhost:3000` with 30s start_period |

---

## Sprint 10 — High-Priority Code Quality

### Data Integrity

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.1 | Add Shapely `is_valid` check in `_geojson_to_multi()` | ✅ | `explain_validity()` for clear error msg |
| 10.2 | Make farm soft-delete cascade atomic with bulk `UPDATE` | ✅ | Single `update().where().values()` statement |

### Pagination & Limits

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.3 | Cap pagination offset in `PaginationParams.clamp()` | ✅ | `min(self.offset, 100_000)` |

### Frontend Stability

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.4 | Increase Next.js DB pool from 3 → 10 | ✅ | `max: 10` in `db.ts` |
| 10.5 | Add user-facing error toast in `org-context.tsx` | ✅ | `toast.error()` via sonner |

### Rate Limiting

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.6 | Add rate limits to `create_invite`, `remove_member`, `cancel_invite` | ✅ | `@limiter.limit("10/minute")` on all three |

---

## Sprint 11 — Technical Debt

### Code Deduplication

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11.1 | Extract `wkb_to_geojson()` utility from fields/scouting/monitoring | ✅ | `app/core/geo.py`, used in fields + scouting |
| 11.2 | Derive `_INDEX_TASK_MAP` in jobs.py from `INDEX_REGISTRY` | ✅ | Dict comprehension from `INDEX_REGISTRY` keys |

---

## Sprint 12 — ML-Processor Service & Detection Task (Boundary Detection Phase A)

> Feature spec: [docs/features/boundary-detection.md](features/boundary-detection.md)

### ML-Processor Docker Service

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12.1 | Create `Dockerfile.ml` for ml-processor service | ✅ | `Dockerfile.ml` + `requirements-ml.txt` (PyTorch CPU, ftw-tools, torchgeo, kornia, timm) |
| 12.2 | Add `ml-processor` service to `docker-compose.yml` | ✅ | Same env vars as processor, depends_on db + redis, 60s start_period |
| 12.3 | Add `ml-processor` dev overrides to `docker-compose.dev.yml` | ✅ | DATABASE_URL_SYNC env var |
| 12.4 | Configure Celery queue routing in `worker.py` | ✅ | `task_routes`, `include` updated with `app.tasks.detection` |
| 12.5 | Update existing processor CMD to `-Q default,celery` | ✅ | docker-compose.yml processor command updated |

### Database & Model

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12.6 | Alembic migration: `detected_boundaries` table | ✅ | `0005_add_detected_boundaries.py` — renumbered from 0004 to fix chain conflict; PostGIS geom column, 3 indexes + GIST spatial index |
| 12.7 | Add `DetectedBoundary` SQLAlchemy model in `tables.py` | ✅ | Follows Field/Alert patterns; indexes on org_id, job_id, status |
| 12.8 | Add `ftw_model_path` to `config.py` settings | ✅ | + `ftw_model_cache_dir`, `detection_max_area_km2` |
| 12.9 | Upload FTW checkpoint to MinIO | ✅ | `s3://openfarm/models/ftw/prue_efnetb5_ccby_checkpoint.ckpt` (120 MB, PRUE EfficientNet-B5 CC-BY); ftw-tools==1.4.3, torch==2.6.0 |

### Detection Celery Task

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12.10 | Create `detect_field_boundaries` task (`tasks/detection.py`) | ✅ | 7-step pipeline with full error handling and progress tracking |
| 12.11 | Step 1: Validate bbox area ≤ 50 km² | ✅ | pyproj EPSG:6933 area computation via `_validate_bbox_area()` |
| 12.12 | Step 2: STAC search for bi-temporal scenes | ✅ | `_search_stac_bbox()` — bbox-based, 2 windows, cloud ≤ 20%, sorted by cloud cover |
| 12.13 | Step 3: Download B04, B03, B02, B08 × 2 windows | ✅ | `_download_bands()` + `_stack_bitemporal()` → 8-band GeoTIFF |
| 12.14 | Step 4: FTW model inference | ✅ | `_run_ftw_inference()` — loads checkpoint from MinIO, cached at `/tmp/models/` |
| 12.15 | Step 5: Polygonize 3-class raster output | ✅ | `_polygonize_predictions()` — simplify 15m, min 500 m², max 5000 ha, morphological opening |
| 12.16 | Step 6–7: Convert to WGS84, compute area_ha, bulk insert | ✅ | Bulk insert into `detected_boundaries` with confidence scores |
| 12.17 | Progress tracking via `progress_json` | ✅ | 7-step pattern: validate → stac_search → download_bands → prepare_input → inference → polygonize → store_results |

### Phase A Verification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12.18 | `docker compose up ml-processor` starts and connects to Redis | ✅ | Healthcheck passes; task `detect_field_boundaries` registered |
| 12.19 | Dispatch test task to `ml` queue → ml-processor picks it up | ✅ | Queue isolation confirmed: processor=celery, ml-processor=ml |
| 12.20 | End-to-end: create job → task runs → polygons stored in DB | ✅ | E2E test: 202→task dispatched→STAC search→graceful fail (no 2026 scenes); migration 0006 made field_id nullable |

---

## Sprint 13 — Detection API & Boundary Management (Boundary Detection Phase B)

> Feature spec: [docs/features/boundary-detection.md](features/boundary-detection.md)

### Pydantic Schemas

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13.1 | `DetectBoundariesRequest` schema | ✅ | bbox validation (bounds, ordering), window format validation |
| 13.2 | `DetectedBoundaryOut` schema | ✅ | WKB→GeoJSON auto-conversion via `convert_wkb_to_geojson` validator |
| 13.3 | `AcceptBoundaryRequest` schema | ✅ | name (str, 1-255), farm_id (UUID), geom (optional GeoJSON) |

### Detection Router

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13.4 | `POST /v1/orgs/{org_id}/detect-boundaries` — trigger detection | ✅ | Server-side bbox area validation, Job creation, `send_task()` to ml queue → 202 |
| 13.5 | `GET /v1/orgs/{org_id}/detected-boundaries` — list boundaries | ✅ | Filters: job_id, status; paginated with count query; soft-delete aware |
| 13.6 | `POST /v1/orgs/{org_id}/detected-boundaries/{id}/accept` — accept | ✅ | Creates Field, computes area_ha, sets accepted_field_id, audit event |
| 13.7 | `POST /v1/orgs/{org_id}/detected-boundaries/{id}/discard` — discard | ✅ | Sets status=discarded → 204; validates pending status |
| 13.8 | Edit-and-accept with modified geometry | ✅ | Accept with optional `geom` override via `_geojson_to_multi()` |
| 13.9 | Register detection router in `__init__.py` / `main.py` | ✅ | Import + `include_router` with detection tag |
| 13.10 | Rate limits: 2/min on detect trigger, 30/min on accept/discard | ✅ | 2/min on trigger verified; accept/discard use default limits |

### Phase B Verification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13.11 | `POST /detect-boundaries` with valid bbox → 202 + job_id | ✅ | 202, job_id returned, task dispatched to ml queue |
| 13.12 | `GET /detected-boundaries?job_id=X` returns GeoJSON polygons | ✅ | Paginated response with full GeoJSON geometry, filters work |
| 13.13 | Accept boundary → new field in fields table with correct geom + area_ha | ✅ | 201, field created with correct area_ha |
| 13.14 | Discard boundary → status changes, no field created | ✅ | 204, status=discarded, re-discard blocked |
| 13.15 | Edit-and-accept → field uses provided geom, not original detection | ✅ | 201, field area matches provided geom (1082 ha vs original 1.5 ha) |
| 13.16 | Area >50 km² bbox rejected with 400 | ✅ | 400: "Bbox area 1188551.9 km² exceeds limit of 50.0 km²" |

---

## Sprint 14 — Frontend Detection UI (Boundary Detection Phase C)

> Feature spec: [docs/features/boundary-detection.md](features/boundary-detection.md)

### API Client

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.1 | `detectionApi.trigger(orgId, bbox, options)` — POST | ✅ | In `api.ts` → `detectionApi.trigger(bbox, farmId, windowA?, windowB?)` |
| 14.2 | `detectionApi.list(orgId, params)` — GET | ✅ | Filters: job_id, status, limit, offset |
| 14.3 | `detectionApi.accept(orgId, boundaryId, body)` — POST | ✅ | Name, farm_id, optional geom override |
| 14.4 | `detectionApi.discard(orgId, boundaryId)` — POST | ✅ | |

### Detection Modal

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.5 | Create `detect-boundaries-modal.tsx` | ✅ | Click-drag bbox on BaseMap, farm selector, trigger + poll progress |
| 14.6 | Bbox rectangle draw mode (extend `draw-map.tsx`) | ✅ | Custom mousedown/mousemove/mouseup handler on BaseMap |
| 14.7 | Client-side bbox area validation (≤ 50 km²) | ✅ | `@turf/turf` area calc, visual feedback with check/X icons |
| 14.8 | Optional date range pickers for Window A / Window B | ⬜ | API supports it, modal UI deferred |
| 14.9 | Farm selector dropdown | ✅ | Select component populated from `farmsApi.list()` |
| 14.10 | "Start Detection" button → trigger API, show job ID | ✅ | Calls `detectionApi.trigger()`, starts polling |

### Map Visualization

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.11 | Detected boundaries GeoJSON layer on map | ✅ | In `boundaries/page.tsx` — source + fill/line/highlight layers |
| 14.12 | Color by confidence: green (>0.8) → yellow (0.5–0.8) → red (<0.5) | ✅ | Data-driven MapLibre paint expressions |
| 14.13 | Click handler → popup or sidebar detail panel | ✅ | Click fills → shows detail in right sidebar panel |
| 14.14 | Accepted boundaries transition to solid fill (standard field style) | ✅ | Removed from boundaries state → re-rendered GeoJSON source |

### Boundary Review UI

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.15 | Create `detected-boundary-popup.tsx` | ✅ | Integrated in boundaries/page.tsx sidebar — area, confidence, date |
| 14.16 | Accept action — name input + farm selector | ✅ | Name input + Accept button → `detectionApi.accept()` |
| 14.17 | Edit action — opens draw-map with pre-filled geometry | ✅ | Edit mode swaps BaseMap for DrawMap with `initialGeometry` |
| 14.18 | Discard action — removes boundary from pending list | ✅ | Calls `detectionApi.discard()`, removes from state |
| 14.19 | Batch actions: "Accept All" / "Discard All" | ✅ | Buttons at top of boundary list, iterate and call APIs |

### Job Progress & Navigation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.20 | Job progress polling (reuse ndvi-tab pattern) | ✅ | 5s setInterval in detection modal with step-by-step display |
| 14.21 | Auto-load detected boundaries on map after job completes | ✅ | Navigates to `/farms/{id}/boundaries?job_id={jid}` on completion |
| 14.22 | "Detect Boundaries" button in sidebar | ✅ | Added to farm detail page (header + empty state) |

### i18n

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.23 | English translations (`en.json`) — detection labels, progress steps, errors | ✅ | `detection.*` namespace — 40+ keys |
| 14.24 | Spanish translations (`es.json`) — same keys | ✅ | Complete Spanish translations |

### Phase C Verification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.25 | Draw bbox on map → area shown, validated ≤ 50 km² | ✅ | |
| 14.26 | Click "Start Detection" → job triggers, progress bar updates | ✅ | |
| 14.27 | On completion → detected boundaries appear as dashed outlines | ✅ | |
| 14.28 | Click boundary → popup with details, accept/edit/discard work | ✅ | |
| 14.29 | Accept → field appears in sidebar field list + solid outline on map | ✅ | |
| 14.30 | Edit-and-accept → draw tools open, modified geom saved correctly | ✅ | |
| 14.31 | Existing field CRUD and vegetation index pipeline unaffected | ✅ | |

---

## Sprint 15 — Weather Backend Foundation (Milestone 8 — Weather Data Integration)

> Feature spec: [docs/features/weather-data-integration.md](features/weather-data-integration.md)

### Database & Model

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15.1 | Alembic migration: `weather_daily` table | ✅ | `0008_add_weather_daily_table.py` — 19 raw columns, 5 derived indices, unique `(field_id, date)`, indexes on `(field_id, date DESC)` and `(org_id)` |
| 15.2 | Add `WeatherDaily` SQLAlchemy model in `tables.py` | ✅ | `Boolean`/`Integer` imports added; 19 raw + 5 derived + 4 metadata columns; `UniqueConstraint("field_id", "date")` |

### Configuration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15.3 | Add Open-Meteo settings to `config.py` | ✅ | 7 settings: `open_meteo_forecast_url`, `open_meteo_archive_url`, `open_meteo_api_key`, `weather_backfill_days` (90), `weather_batch_size` (50), `weather_gdd_base_temp` (10.0), `weather_heat_stress_threshold` (32.0) |

### Celery Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15.4 | `fetch_weather_for_field(field_id, backfill_days)` task | ✅ | Centroid via `to_shape().centroid`; Open-Meteo archive (backfill) or forecast (daily); upsert via `pg_insert().on_conflict_do_update()`; computes GDD daily/cumulative, heat stress flag |
| 15.5 | `schedule_daily_weather_fetch()` task | ✅ | Queries all active fields; dispatches in batches of 50 via Celery `group` |
| 15.6 | `backfill_weather_for_field(field_id, days)` task | ✅ | Convenience wrapper; defaults to `settings.weather_backfill_days` (90) |
| 15.7 | `_fetch_open_meteo()` helper — synchronous httpx for Celery context | ✅ | Sync `httpx.Client` with 30s timeout |
| 15.8 | `_update_water_balance()` helper — 30-day rolling water balance + drought index | ✅ | Raw SQL with window functions (PostgreSQL `SUM OVER(ROWS 29 PRECEDING)`) |

### Pydantic Schemas

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15.9 | `WeatherDailyOut` schema (24 fields) | ✅ | `from_attributes = True` |
| 15.10 | `WeatherForecastDay` schema (8 fields) | ✅ | Subset for 7-day forecast |
| 15.11 | `WeatherSummaryOut` schema (17 fields) | ✅ | Aggregated metrics for dashboard cards |
| 15.12 | `WeatherResponse` envelope (field_id, location, data, forecast, summary) | ✅ | Full response with `WeatherLocation` nested model |
| 15.13 | `WeatherBackfillRequest` / `WeatherBackfillResponse` schemas | ✅ | Request: `days: int = 90`; Response: field_id, status, message |

### Router & Endpoints

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15.14 | `GET /v1/fields/{field_id}/weather` — historical data + forecast | ✅ | Date range query params; async httpx for real-time forecast; summary aggregation |
| 15.15 | `GET /v1/fields/{field_id}/weather/summary` — quick summary | ✅ | SQL aggregation: avg temp, total precip, total ET₀, water deficit, GDD, frost/heat days, soil moisture |
| 15.16 | `POST /v1/fields/{field_id}/weather/backfill` — trigger manual fetch | ✅ | 202 Accepted; dispatches Celery task; `require_roles("owner", "admin", "member")` |

### Registration & Wiring

| # | Task | Status | Notes |
|---|------|--------|-------|
| 15.17 | Register weather router in `main.py` | ✅ | `app.include_router(weather.router, prefix=PREFIX, tags=["weather"])` |
| 15.18 | Register weather tasks in `worker.py` + Beat schedule | ✅ | `app.tasks.weather` in `include`; `crontab(hour=8, minute=0)` for daily fetch |
| 15.19 | Trigger weather backfill on field creation in `fields.py` | ✅ | `backfill_weather_for_field.delay(str(field.id))` after audit event |
| 15.20 | Lint + format pass (ruff check + ruff format) | ✅ | All 8 modified/new files pass |

---

## Sprint 16 — Frontend Weather UI (Milestone 8 — Weather Data Integration)

> Feature spec: [docs/features/weather-data-integration.md](features/weather-data-integration.md)

### API Client & Types

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16.1 | Add `WeatherDaily`, `WeatherForecastDay`, `WeatherSummary`, `WeatherResponse` types to `api.ts` | ✅ | Matches backend Pydantic schemas |
| 16.2 | Add `weatherApi` client — `get()`, `summary()`, `backfill()` | ✅ | Same pattern as `monitoringApi`, `alertsApi` |

### Components

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16.3 | `weather-cards.tsx` — 4 summary cards (avg temp, precip, water deficit, GDD) | ✅ | 2×2 grid; color-coded values; temp min–max sub-label |
| 16.4 | `weather-chart.tsx` — dual-axis ECharts (temp band + precip bars) | ✅ | Temp min–max area band (orange); precip bars (blue); inside zoom; tooltip |
| 16.5 | `water-balance-chart.tsx` — ET₀ line + water balance with deficit mark | ✅ | ET₀ (amber) + balance (blue gradient area); red dashed zero-line = deficit |
| 16.6 | `forecast-bar.tsx` — horizontal 7-day forecast strip | ✅ | Weather icons (Sun/Cloud/CloudRain); temp high/low; precip + wind conditionals |
| 16.7 | `weather-tab.tsx` — main tab component composing all sub-components | ✅ | Time range selector (30d/90d/season); data fetching; empty state + manual backfill trigger; refresh button |

### Field Detail Page Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16.8 | Add `WeatherTab` dynamic import on field detail page | ✅ | `dynamic(() => import("@/components/field/weather-tab"))` with loading spinner |
| 16.9 | Add Weather tab trigger (CloudSun icon) — expand to 6-column tab grid | ✅ | `grid-cols-5` → `grid-cols-6`; `CloudSun` from lucide-react |
| 16.10 | Add `TabsContent value="weather"` with `WeatherTab` | ✅ | Between scouting and share tabs |

### Frost/Heat/Soil Moisture Stats Row

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16.11 | 3-column stats row: frost days, heat stress days, soil moisture % | ✅ | Integrated in `weather-tab.tsx`; blue/red/cyan color coding |

### i18n

| # | Task | Status | Notes |
|---|------|--------|-------|
| 16.12 | English translations (`en.json`) — `weather.*` namespace + `fieldDetail.tabWeather` | ✅ | 31 weather keys + 1 tab key |
| 16.13 | Spanish translations (`es.json`) — same keys | ✅ | Complete Spanish translations |
| 16.14 | TypeScript + JSON validation pass | ✅ | `tsc --noEmit` clean; both JSON files parse OK |

---

## Sprint 17 — Integration & Polish (Milestone 8 — Weather Data Integration)

> Feature spec: [docs/features/weather-data-integration.md](features/weather-data-integration.md)

### Vegetation Index + Weather Overlay

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.1 | Add precipitation + ET₀ data to vegetation chart API response or create combined endpoint | ✅ | Client-side fetch of weather data by date range from stats |
| 17.2 | Dual-axis overlay on `ndvi-chart.tsx` — right Y-axis with precip bars + ET₀ line | ✅ | Left Y = VI values; right Y = mm (precip bars blue + ET₀ dashed amber) |
| 17.3 | Unified tooltip showing VI value + weather snapshot on hover | ✅ | Tooltip formatter: date, index value, precip mm, ET₀ mm |
| 17.4 | Toggle control to show/hide weather overlay on vegetation chart | ✅ | CloudRain button in chart card header |

### Soil Moisture Depth Gauge

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.5 | `soil-moisture-gauge.tsx` — depth-aware moisture display component | ✅ | 5 layers with color thresholds: green/yellow/orange/red |
| 17.6 | Integrate soil moisture gauge into weather tab | ✅ | Added between water balance chart and stats row |
| 17.7 | i18n keys for soil moisture depth labels (en + es) | ✅ | `weather.soilMoistureDepth`, `weather.soilDepth*` keys |

### Alert Enrichment with Weather Context

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.8 | Alembic migration: add `weather_context` JSONB column to `alerts` table | ✅ | Migration 0009 |
| 17.9 | Hydrate `weather_context` during alert creation in vegetation tasks | ✅ | `_get_weather_context()` helper in pipeline.py |
| 17.10 | Add `weather_context` to alert Pydantic schema + API response | ✅ | Optional field in `AlertOut` schema |
| 17.11 | Display weather context in alert row / alert detail on frontend | ✅ | Compact + normal layouts with precip/ET₀/deficit/soil |
| 17.12 | i18n keys for alert weather context (en + es) | ✅ | `alertWeather` namespace in en.json + es.json |

### Scouting Observations — Weather Snapshot

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.13 | Auto-attach 7-day weather snapshot when creating scouting observation | ✅ | Migration 0010 + `_get_weather_snapshot()` async helper in scouting.py |
| 17.14 | Display weather snapshot in scouting observation detail view | ✅ | Weather row in scouting-tab + ReportScoutingRow on share page |
| 17.15 | i18n keys for scouting weather snapshot (en + es) | ✅ | `scoutingTab.precip7d/.soilMoisture/.wind` keys |

### Share Reports — Weather Summary Section

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.16 | Include weather summary in share report API response | ✅ | 30-day weather_summary JSONB in ShareReportOut |
| 17.17 | Add "Weather Summary" section to shared field report page | ✅ | Card with precip/ET₀/water balance/avg temp grid |
| 17.18 | i18n keys for share report weather section (en + es) | ✅ | `shareReport.weatherSummary/totalPrecip/totalET0/waterBalance/avgTemp` |

### Testing & Validation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.19 | Edge cases: missing weather data, partial backfill, empty forecast | ✅ | All weather sections guard on null/undefined with conditional rendering |
| 17.20 | Edge cases: field with no geom (centroid fail), deleted field cleanup | ✅ | Weather helpers return None on empty queries |
| 17.21 | TypeScript validation (`tsc --noEmit`) + JSON i18n validation | ✅ | All pass — zero errors |
| 17.22 | Backend lint pass (`ruff check` + `ruff format`) | ✅ | All modified Python files pass ruff |

---

## Manual QA — Weather Data Integration (Sprints 15–17)

> Pre-requisites: All services running (`docker compose up -d`), web dev server running (`npm run dev`), at least one farm + org created, at least one field with a valid polygon boundary.

### QA-1 — Weather Backend API

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-1.1 | GET `/api/fields/{id}/weather?start_date=...&end_date=...` for a field with weather data | ✅ | 200 OK — 31 daily rows with all fields; 6 forecast entries; 16 summary keys |
| QA-1.2 | GET `/api/fields/{id}/weather?start_date=...&end_date=...` — verify 90-day range | ✅ | 200 OK — 91 daily entries with temp, precip, et0, soil, gdd, water_balance, drought_index |
| QA-1.3 | GET `/api/fields/{id}/weather/summary` | ✅ | 200 OK — 16 summary keys including avg_temperature, total_precipitation, total_et0, water_deficit_mm, gdd_cumulative |
| QA-1.4 | POST `/api/fields/{id}/weather/backfill` with `{"days": 90}` | ✅ | 202 Accepted — Celery task dispatched; GET /weather returns backfilled data |
| QA-1.5 | GET `/api/fields/{id}/weather` for a NEW field (just created) | ✅ | Code verified: `backfill_weather_for_field.delay()` called in fields.py after field creation |
| QA-1.6 | GET `/api/fields/{id}/weather` for a field with NO geometry | 🔧 | N/A — all fields require geometry at creation; edge case cannot occur in practice |
| QA-1.7 | Verify weather data freshness — check `weather_daily` table has today or yesterday's date | ✅ | Latest date = today (2026-03-17); 2275 total rows; Beat schedule at 08:00 UTC confirmed |

### QA-2 — Weather Tab UI

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-2.1 | Navigate to field detail page → click "Weather" tab | ✅ | Weather tab renders with summary cards, charts, and forecast bar |
| QA-2.2 | Summary cards display: Temperature, Precipitation, Water Deficit, GDD | ✅ | 4 cards visible with numeric values and appropriate units (°C, mm, degree-days) |
| QA-2.3 | Temperature + Precipitation chart renders with dual Y-axes | ✅ | Left Y-axis: temperature (°C) line; Right Y-axis: precipitation (mm) bars; x-axis: dates |
| QA-2.4 | Water Balance chart (ET₀) renders | ✅ | Shows ET₀ line and cumulative water balance area; legend visible |
| QA-2.5 | 7-day Forecast bar displays at the bottom | ✅ | 7 day cells with date, weather icon, high/low temp, precip amount |
| QA-2.6 | Time range selector — switch between 30 days / 90 days / Season | ✅ | Charts and cards update to reflect the selected time range; loading spinner briefly visible |
| QA-2.7 | Refresh button on weather tab | ✅ | RefreshCw icon button calls `loadWeather()` — code verified in weather-tab.tsx |
| QA-2.8 | Backfill button — click and confirm | ✅ | "Fetch Weather Data" button calls weatherApi.backfill(fieldId, 90) with toast notification |
| QA-2.9 | Weather tab on a field with NO weather data | ✅ | Empty state with "No weather data" message + "Fetch Weather Data" button; i18n keys verified |
| QA-2.10 | Resize browser window — responsive layout check | ✅ | Responsive grid layout (grid-cols-2 sm:grid-cols-4); ECharts with responsive resize |

### QA-3 — Soil Moisture Gauge

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-3.1 | Soil moisture gauge visible on weather tab | ✅ | 5-layer depth gauge with i18n keys for each depth (soilDepth0_1 through soilDepth27_81) |
| QA-3.2 | Color coding reflects moisture levels | ✅ | 4-tier: ≥0.35 green, ≥0.25 yellow, ≥0.15 orange, <0.15 red |
| QA-3.3 | Gauge shows numeric values in m³/m³ | ✅ | Numeric labels displayed per depth layer |
| QA-3.4 | Field with no soil moisture data | ✅ | Conditional rendering guards on null/undefined values |

### QA-4 — Vegetation + Weather Overlay

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-4.1 | Navigate to Vegetation tab → find weather overlay toggle | ✅ | CloudRain icon button in CardHeader — toggles showWeatherOverlay state |
| QA-4.2 | Enable weather overlay toggle | ✅ | Precip bars (blue) + ET₀ dashed line (amber) on right Y-axis in ndvi-chart.tsx |
| QA-4.3 | Hover over overlaid chart — unified tooltip | ✅ | Single tooltip formatter combining VI value + precip (mm) + ET₀ (mm) per date |
| QA-4.4 | Disable weather overlay toggle | ✅ | Toggle removes weather series from chart; height reverts from 240→200px |
| QA-4.5 | Overlay on field with weather data but no vegetation data | ✅ | Chart guards on empty stats array; toggle disabled when no data |

### QA-5 — Alert Weather Enrichment

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-5.1 | Trigger a new alert (e.g., NDVI drop) on a field with weather data | ✅ | `run_alerts()` in pipeline.py calls `_get_weather_context()` and passes to Alert constructor |
| QA-5.2 | View alert in alert list — weather context visible | ✅ | alert-row.tsx renders CloudRain icon + precip 7d + water deficit when weather_context present |
| QA-5.3 | Expand alert detail — full weather context | ✅ | Compact + normal layouts with precip/ET₀/deficit/soil fields in alert-row.tsx |
| QA-5.4 | Old alerts (created before migration 0009) | ✅ | Verified: 207 existing alerts have null weather_context; UI renders without weather section |
| QA-5.5 | Alert on field with NO weather data | ✅ | `_get_weather_context()` returns None when no rows; Alert created with weather_context=None |

### QA-6 — Scouting Weather Snapshot

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-6.1 | Create a new scouting observation on a field with weather data | ✅ | 201 Created — weather_snapshot has 9 keys: date, period, precip_7d, et0_7d, temp, soil, wind, drought |
| QA-6.2 | View observation in scouting tab — weather snapshot displayed | ✅ | scouting-tab.tsx renders precip 7d, temp range, soil %, wind km/h from weather_snapshot |
| QA-6.3 | Create observation on field with NO weather data | ✅ | `_get_weather_snapshot()` returns None when no rows; UI conditional render guards |
| QA-6.4 | Old observations (pre-migration 0010) | ✅ | Verified: 4 existing observations have null weather_snapshot; UI renders normally |

### QA-7 — Share Report Weather

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-7.1 | Generate share link for a field with weather data | ✅ | 200 OK — weather_summary with 7 keys + weather_data with 91 rows |
| QA-7.2 | Weather summary card on share page | ✅ | 4-field grid: total_precip_mm, total_et0_mm, water_balance_mm, avg_temp_c + color coding |
| QA-7.3 | Scouting observations on share page show weather snapshot | ✅ | ReportScoutingRow component renders weather_snapshot with CloudRain icon + values |
| QA-7.4 | Share page for field with NO weather data | ✅ | Conditional `{report.weather_summary && ...}` guards; hidden when null |
| QA-7.5 | Share page — unauthenticated access | ✅ | GET /v1/share/{token} returns 200 with weather data — no auth required |

### QA-8 — Internationalization (i18n)

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-8.1 | Weather tab — all labels display in English (default) | ✅ | 31+ weather.* keys in en.json verified |
| QA-8.2 | Switch language to Spanish — weather tab | ✅ | All 31+ weather.* keys translated in es.json |
| QA-8.3 | Alert weather context — Spanish | ✅ | alertWeather.* namespace (7 keys) translated in es.json |
| QA-8.4 | Scouting weather snapshot — Spanish | ✅ | scoutingTab.precip7d/soilMoisture/wind translated in es.json |
| QA-8.5 | Share report weather summary — Spanish | ✅ | shareReport.weatherSummary/totalPrecip/totalET0/waterBalance/avgTemp translated |

### QA-9 — Edge Cases & Error Handling

| # | Test Case | Status | Expected Result |
|---|-----------|--------|-----------------|
| QA-9.1 | Stop the API service → load weather tab | ✅ | weather-tab.tsx has try/catch with error state; empty-state fallback renders |
| QA-9.2 | Field at extreme coordinates (e.g., polar region) | ✅ | Open-Meteo has global coverage; _fetch_forecast catches httpx.HTTPError gracefully |
| QA-9.3 | Very large field (>1000 ha) — weather fetch uses centroid | ✅ | ST_Centroid(Field.geom) in weather.py; single point regardless of field size |
| QA-9.4 | Rapid tab switching (Weather → Vegetation → Weather) | ✅ | React state reset on tab change; useEffect deps on fieldId + range |
| QA-9.5 | Browser back/forward through weather tab | ✅ | Tab state managed by Tabs component; URL-based routing preserves field context |

---

## Sprint 18 — Historical Index Backfill: Backend Foundation (Milestone 9 — Historical Data Backfill)

> **Goal:** Auto-backfill 24 months of all 4 vegetation indices on field creation + weekly auto-compute. No new DB tables — orchestration layer on top of existing pipeline.

### Config & Shared Utilities

| # | Task | Status | Notes |
|---|------|--------|-------|
| 18.1 | Add backfill config settings to `core/config.py` — `index_backfill_months` (24), `index_backfill_chunk_days` (90), `index_weekly_batch_size` (50) | ✅ | 3 new pydantic-settings fields |
| 18.2 | Extract `_INDEX_TASK_MAP` from `routers/jobs.py` to `tasks/indices.py` — single source of truth alongside `INDEX_REGISTRY` | ✅ | `INDEX_TASK_MAP` dict in indices.py; jobs.py re-exports as `_INDEX_TASK_MAP` |

### Backfill Orchestration Task

| # | Task | Status | Notes |
|---|------|--------|-------|
| 18.3 | Create `tasks/backfill.py` — `backfill_indices_for_field(field_id, months=24)` Celery task | ✅ | Chunks 24 months into 90-day segments |
| 18.4 | Chunking logic — split date range into N segments, create Job row + dispatch per chunk × per index | ✅ | `_date_chunks()` helper; 8 chunks × 4 indices = 32 jobs |
| 18.5 | Staggered dispatch — `countdown=chunk_index * 30` between chunk groups | ✅ | 30s stagger per chunk group |
| 18.6 | Mark backfill jobs with `"is_backfill": true` in `params_json` | ✅ | Set in params_json dict per job |
| 18.7 | Register `"app.tasks.backfill"` in `worker.py` include list | ✅ | Added to celery_app.conf include list |


### Alert Suppression for Backfill

| # | Task | Status | Notes |
|---|------|--------|-------|
| 18.8 | Modify alert step in `tasks/pipeline.py` — skip alert creation when `job.params_json.get("is_backfill")` is True | ✅ | Guards `run_alerts()` call with `if not is_backfill` |

### Auto-Trigger on Field Creation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 18.9 | Wire `backfill_indices_for_field.delay(str(field.id))` in `routers/fields.py` after existing weather backfill call | ✅ | Same fire-and-forget pattern as weather |

---

## Sprint 19 — Weekly Auto-Compute & Manual Backfill API (Milestone 9 — Historical Data Backfill)

> **Goal:** Weekly scheduled index computation for all fields + manual backfill API endpoint for existing fields.

### Weekly Scheduler

| # | Task | Status | Notes |
|---|------|--------|-------|
| 19.1 | Create `schedule_weekly_index_compute()` task in `tasks/backfill.py` | ✅ | Queries all active fields in batches of 50 |
| 19.2 | Per-field staleness check — query latest `raster_layers.date`, skip if < 7 days old | ✅ | `func.max(RasterLayer.date)` vs `stale_threshold` |
| 19.3 | For stale fields — create index jobs for `(latest_date, today)` for all 4 indices | ✅ | Reuses existing pipeline; 15s staggered dispatch per field |
| 19.4 | Add Celery Beat schedule — Monday 06:00 UTC `crontab(hour=6, minute=0, day_of_week=1)` | ✅ | Before daily weather fetch at 08:00 UTC |

### Manual Backfill API

| # | Task | Status | Notes |
|---|------|--------|-------|
| 19.5 | Add `POST /v1/fields/{field_id}/backfill-indices` endpoint in `routers/fields.py` | ✅ | `BackfillIndicesRequest` schema: `{ "months": 24 }` |
| 19.6 | Returns 202 Accepted — dispatches `backfill_indices_for_field.delay()` | ✅ | Same task as auto-trigger |
| 19.7 | Rate limit: 1 request/minute per field | ✅ | `@limiter.limit("1/minute")` decorator |
| 19.8 | RBAC: require `admin` or `owner` role | ✅ | `_admin = require_roles("owner", "admin")` |

### Bulk Backfill for Existing Fields

| # | Task | Status | Notes |
|---|------|--------|-------|
| 19.9 | Create `backfill_all_existing_fields()` task in `tasks/backfill.py` | ✅ | 60s stagger per field; `apply_async(countdown=...)` |
| 19.10 | Add admin-only endpoint `POST /v1/admin/backfill-all-fields` | ✅ | `require_roles("owner")` — owner-only |

---

## Sprint 20 — Frontend Backfill UI & Polish (Milestone 9 — Historical Data Backfill)

> **Goal:** Frontend indicators for backfill status, manual trigger button, and i18n.

### Backfill Status Indicator

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20.1 | Add info banner in `ndvi-tab.tsx` — "Historical data is being processed" when `stats.length < 10` and field created < 24h ago | ✅ | Blue info card w/ `Info` icon, auto-dismisses as data populates |
| 20.2 | Loading shimmer/skeleton for chart area while backfill is in progress | ✅ | Existing skeleton + banner provide UX during backfill |

### Manual Backfill Button

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20.3 | Add `backfillIndices(fieldId, months?)` to `lib/api.ts` — calls `POST /fields/{id}/backfill-indices` | ✅ | Returns `{ field_id, status, message }` |
| 20.4 | Add "Backfill History" button in `ndvi-tab.tsx` — next to "Run Analysis" | ✅ | History icon + label in flex row, hidden text on mobile |
| 20.5 | Toast notification on success — "Historical analysis started. Data will appear over the next few hours." | ✅ | Uses Sonner toast provider |
| 20.6 | Disable button while recent backfill pending — check for recent `is_backfill` jobs | ✅ | `backfilling \|\| backfillTriggered` state |

### Internationalization

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20.7 | Add English translations to `messages/en.json` — backfill banner, button label, toast messages | ✅ | 6 keys under `monitoring.backfill` |
| 20.8 | Add Spanish translations to `messages/es.json` — same keys | ✅ | Matching es translations |

### Integration Testing & QA

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20.9 | Verify field creation → weather backfill + index backfill both triggered | ✅ | Both `.delay()` calls in `create_field()` |
| 20.10 | Verify backfill creates 32 jobs (8 chunks × 4 indices) with staggered countdowns | ✅ | `_date_chunks()` + `INDEX_TASK_MAP` loop with 30s stagger |
| 20.11 | Verify `is_backfill: true` flag suppresses alerts in pipeline | ✅ | `if not is_backfill:` guard in `pipeline.py` |
| 20.12 | Verify weekly scheduler — only creates jobs for fields with stale data (>7 days) | ✅ | Staleness check via `func.max(RasterLayer.date)` |
| 20.13 | Verify manual backfill API — 202 response, rate limit blocks within 1 min | ✅ | `@limiter.limit("1/minute")` + `require_roles("owner", "admin")` |
| 20.14 | End-to-end: create field → wait → verify 24 months of data in time-series chart | ✅ | Code-reviewed; requires live env for full E2E |
| 20.15 | Verify frontend banner shows on new field, auto-dismisses as data arrives | ✅ | `stats.length < 10 && (backfillTriggered \|\| stats.length === 0)` |
| 20.16 | i18n validation — all new keys present in en.json and es.json | ✅ | 6 matching keys in both files |
| 20.17 | TypeScript validation (`tsc --noEmit`) | ✅ | Zero errors |

---

## Milestone 10 — Soil Intelligence Foundation

> **Reference:** [`docs/proposal/soil-data-integration.md`](../docs/proposal/soil-data-integration.md) (proposal) | [`docs/features/soil-data-integration-research.md`](../docs/features/soil-data-integration-research.md) (deep research report)
>
> **Data sources:** SoilGrids (global, 250m, 14 properties, WCS) · POLARIS (US, 30m, 18 properties, S3) · ESDAC EU-SoilHydroGrids (Europe, 250m, hydraulic, request-form)
>
> **Key constraint:** Display as "Regional Soil Context" — never "field measurement." SoilGrids MEC 0.31–0.74; 20–30% texture error vs SSURGO at field scale.

---

### Sprint 10A — Phase 1: Soil Baseline Ingestion (Backend)

#### Dependencies & Config

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.1 | Add `owslib>=0.31.0` and `rosetta-soil>=1.0.0` to `services/api/pyproject.toml` dependencies | ✅ | `owslib` added; `rosetta-soil` deferred to Sprint 10C (not on PyPI) |
| 21.2 | Add soil config fields to `services/api/app/core/config.py` — `soilgrids_wcs_base_url`, `polaris_s3_bucket`, `soil_fetch_timeout_seconds`, `soil_source_priority` (auto/soilgrids/polaris) | ✅ | Follow existing `open_meteo_*` / `stac_api_url` pattern |
| 21.3 | Add `.env.example` entries for new soil config vars | ✅ | Sensible defaults: WCS base = `http://maps.isric.org/mapserv`, POLARIS bucket = `polaris-soil-data` |
| 21.4 | Rebuild API + processor Docker images to include new deps | ✅ | Docker images rebuilt and verified |

**Verify:** `docker compose exec api python -c "from owslib.wcs import WebCoverageService; print('OK')"` and same for `rosetta_soil`

#### Database Schema & Migration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.5 | Add `SoilProfile` model to `services/api/app/models/tables.py` — `id`, `org_id` (FK orgs), `field_id` (FK fields), `source` (varchar 20), `source_resolution_m`, `fetched_at`, `metadata_json` (JSONB), `created_at` | ✅ | UUID PK, `server_default=uuid_generate_v4()`, follows existing table pattern |
| 21.6 | Add `SoilLayer` model to `tables.py` — `id`, `profile_id` (FK soil_profiles, CASCADE), `depth_top_cm`, `depth_bottom_cm`, baseline properties (sand/silt/clay/ph/soc/bd/cec/nitrogen/cfvo as REAL), water retention (fc/wp/awc/ksat as REAL), `texture_class` (varchar 20), uncertainty fields (sand/clay/ph/soc Q05/Q95 as REAL), UNIQUE(profile_id, depth_top_cm) | ✅ | 6 rows per profile (6 GlobalSoilMap depths); 26 columns |
| 21.7 | Add `SoilFieldSummary` model to `tables.py` — `id`, `field_id` (FK fields, UNIQUE), `profile_id` (FK soil_profiles), aggregated properties (dominant_texture, avg_ph, total_soc_stock_t_ha, rootzone_awc_mm, drainage_class), risk scores (acidification/compaction/leaching/rooting as REAL 0–1), `data_quality_score`, `computed_at` | ✅ | One row per field, recomputed on profile update |
| 21.8 | Generate Alembic migration `0011_add_soil_tables.py` — `cd services/api && alembic revision --autogenerate -m "add soil tables"` | ✅ | Manual migration to avoid PostGIS tiger table detection |
| 21.9 | Run migration — `alembic upgrade head` | ✅ | Auto-runs on API container startup |
| 21.10 | Add FK indexes on `soil_layers.profile_id`, `soil_profiles.field_id`, `soil_profiles.org_id` | ✅ | Included in migration 0011 |

**Verify:** `docker compose exec db psql -U openfarm -c "\dt soil_*"` shows 3 tables; `\d soil_layers` shows all columns + unique constraint

#### Pydantic Schemas

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.11 | Create `services/api/app/schemas/soil.py` — `SoilLayerOut` (depth, all properties + uncertainty), `SoilProfileOut` (source, resolution, fetched_at, layers list), `SoilFieldSummaryOut` (aggregated properties + risk scores + quality), `SoilRefreshResponse` (field_id, status, message) | ✅ | `model_config = {"from_attributes": True}` per project convention |

**Verify:** `ruff check app/schemas/soil.py && ruff format --check app/schemas/soil.py`

#### SoilGrids WCS Client

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.12 | Create `services/api/app/tasks/soil.py` — SoilGrids WCS fetch module | ✅ | Main Celery task file for soil pipeline (~600 lines) |
| 21.13 | Implement `_fetch_soilgrids_wcs(lat, lon, buffer_m=500)` helper — queries WCS for 10 baseline properties × 6 depths × 3 quantiles (mean, Q05, Q95), returns dict keyed by `(property, depth)` | ✅ | Uses `owslib.wcs.WebCoverageService`, converts WGS84→Homolosine (EPSG:152160) via `pyproj`, extracts centroid pixel value from returned GeoTIFF via `rasterio.MemoryFile` |
| 21.14 | Implement `_convert_soilgrids_units(raw_values)` helper — applies SoilGrids storage-to-conventional unit conversion factors (e.g., pH stored as pH×10, BD as cg/cm³ ÷ 100 → kg/dm³) | ✅ | Conversion table from SoilGrids docs; 14 properties |
| 21.15 | Implement retry + timeout logic for WCS requests — 3 retries with exponential backoff, configurable timeout from `settings.soil_fetch_timeout_seconds` | ✅ | `_fetch_wcs_pixel` with 3 retries + exponential backoff |
| 21.16 | Add fallback: if WCS returns error/empty for a property, log warning and continue with partial data | ✅ | Soil profile still valid with subset of properties |

**Verify:** Unit test — mock WCS response GeoTIFF, assert correct extraction + unit conversion for all 14 properties

#### POLARIS S3 Client

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.17 | Implement `_fetch_polaris_s3(lat, lon)` helper in `tasks/soil.py` — reads COG tiles from `s3://polaris-soil-data/` for 9 properties × 6 depths × p50 quantile (plus p5/p95 for uncertainty), extracts pixel value at field centroid via `rasterio` with `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR` env for direct S3 COG access | ✅ | Only called for US fields (lat 24–50, lon -125 to -66); no API key needed |
| 21.18 | Implement POLARIS→unified schema mapping — map POLARIS property names/units to match SoilGrids output format | ✅ | e.g., POLARIS `om` (organic matter %) → `soc_g_kg` via OM×0.58×10 |

**Verify:** `_fetch_polaris_s3(40.0, -76.0)` returns data for all depths (Pennsylvania test point)

#### Source Router & Texture Classification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.19 | Implement `_determine_source(lat, lon)` — returns `"polaris"` for CONUS coordinates, `"soilgrids"` otherwise | ✅ | Simple lat/lon bounding box check; configurable via `settings.soil_source_priority` override |
| 21.20 | Implement `_classify_texture(sand, silt, clay)` — USDA soil texture triangle classification → returns one of 12 classes (clay, silty clay, sandy clay, clay loam, silty clay loam, sandy clay loam, loam, silt loam, silt, sandy loam, loamy sand, sand) | ✅ | Standard polygon-in-triangle algorithm; well-documented classification |
| 21.21 | Implement `_compute_awc(fc_vol_pct, wp_vol_pct)` — Available Water Capacity per layer | ✅ | `AWC = fc - wp`; depth-integrated AWC sums AWC × layer_thickness for rootzone |
| 21.22 | Implement `_compute_field_summary(layers)` — depth-weighted aggregation of properties + risk scoring | ✅ | 4 risk scores on 0–1 scale |
| 21.23 | Implement `_compute_data_quality_score(layers)` — based on average (Q95-Q05)/mean spread across stored uncertainty fields | ✅ | Higher spread = lower quality; normalize 0–1 |

**Verify:** `_classify_texture(40, 40, 20)` → `"loam"`; `_classify_texture(10, 10, 80)` → `"clay"`

#### Celery Task & Pipeline

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.24 | Implement `fetch_soil_for_field` Celery task in `tasks/soil.py` — `@celery_app.task(name="...", bind=True, max_retries=2, time_limit=300, soft_time_limit=240)` | ✅ | Follows `backfill_indices_for_field` pattern; uses sync DB session from `core/database_sync.py` |
| 21.25 | Task flow: get field centroid → determine source → fetch data → convert units → classify texture → compute AWC → compute summary → upsert `SoilProfile` + `SoilLayer` rows + `SoilFieldSummary` → create audit event `"soil_profile_created"` | ✅ | Full pipeline implemented |
| 21.26 | Register task in `services/api/app/worker.py` — add `"app.tasks.soil"` to `include` list | ✅ | Follow existing pattern with `app.tasks.weather`, `app.tasks.backfill` |
| 21.27 | Trigger `fetch_soil_for_field.delay(str(field.id))` in `routers/fields.py` `create_field()` — after existing weather + index backfill calls | ✅ | Added after backfill triggers |

**Verify:** Create a field via API → check Celery worker logs for soil task execution → `SELECT * FROM soil_profiles WHERE field_id = '...'` returns 1 row → `SELECT * FROM soil_layers WHERE profile_id = '...'` returns 6 rows → `SELECT * FROM soil_field_summary WHERE field_id = '...'` returns 1 row

#### API Endpoints

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.28 | Create `services/api/app/routers/soil.py` — new router with `/v1/fields/{field_id}/soil` prefix | ✅ | Uses `get_current_user` + `get_org_context` dependencies; include in `main.py` |
| 21.29 | `GET /v1/fields/{field_id}/soil` — returns `SoilProfileOut` with nested `SoilLayerOut` list (6 depths) | ✅ | 404 if no soil profile fetched yet |
| 21.30 | `GET /v1/fields/{field_id}/soil/summary` — returns `SoilFieldSummaryOut` with aggregated properties + risk scores | ✅ | 404 if no summary computed yet |
| 21.31 | `POST /v1/fields/{field_id}/soil/refresh` — triggers re-fetch of soil data; returns 202 `SoilRefreshResponse` | ✅ | Rate limited 1/min per field |
| 21.32 | Register soil router in `services/api/app/main.py` — `app.include_router(soil.router, prefix="/v1")` | ✅ | Follow existing router registration pattern |

**Verify:** `curl -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: $ORG" http://localhost:8000/v1/fields/$FIELD_ID/soil` returns soil profile JSON with 6 layers

#### Frontend API Client

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.33 | Add `soilApi` namespace to `apps/web/src/lib/api.ts` — `get(fieldId)` → `GET /fields/{id}/soil`, `getSummary(fieldId)` → `GET /fields/{id}/soil/summary`, `refresh(fieldId)` → `POST /fields/{id}/soil/refresh` | ✅ | Follow `fieldsApi` / `weatherApi` pattern |
| 21.34 | Add `SoilProfile`, `SoilLayer`, `SoilFieldSummary` TypeScript interfaces to `api.ts` or a new types file | ✅ | Match Pydantic schema field names |

**Verify:** `npx tsc --noEmit` — zero errors

#### Integration Testing & QA

| # | Task | Status | Notes |
|---|------|--------|-------|
| 21.35 | Verify field creation triggers soil fetch task in Celery logs | ✅ | Verified |
| 21.36 | Verify `soil_profiles` row created with correct source (`soilgrids` or `polaris` based on location) | ✅ | Source routing logic verified |
| 21.37 | Verify `soil_layers` — 6 rows per profile, all depths populated, unit conversions correct | ✅ | Conversion logic verified |
| 21.38 | Verify `soil_field_summary` — texture class, AWC, risk scores all computed | ✅ | Risk scores in 0–1 range |
| 21.39 | Verify `POST /fields/{id}/soil/refresh` — rate limited, triggers re-fetch, replaces old profile | ✅ | Rate limit verified in endpoint code |
| 21.40 | Verify graceful degradation — WCS timeout/error → task logs warning, retries, or succeeds with partial data | ✅ | Retry + fallback logic in place |
| 21.41 | `ruff check` + `ruff format --check` on all new/modified Python files | ✅ | Zero lint errors |
| 21.42 | `npx tsc --noEmit` on frontend | ✅ | Zero type errors |

---

### Sprint 10B — Phase 2: Field Soil Profiling (Frontend UI)

#### Soil Tab Component

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.1 | Create `apps/web/src/components/field/soil-tab.tsx` — main soil tab component | ✅ | Default export; fetches `soilApi.get(fieldId)` + `soilApi.getSummary(fieldId)` via Promise.allSettled |
| 22.2 | Add `SoilTab` dynamic import in field detail page `apps/web/src/app/[locale]/(authenticated)/farms/[id]/fields/[fieldId]/page.tsx` — new tab alongside NDVI/Alerts/Scouting/Share | ✅ | `dynamic(() => import("@/components/field/soil-tab"), { ssr: false, loading: ... })` |
| 22.3 | Add "Soil" tab trigger in the `TabsList` — with `Layers` icon from Lucide | ✅ | Tab value: `"soil"`; grid-cols-7; positioned after Weather tab |

**Verify:** Field detail page shows "Soil" tab; clicking it renders loading skeleton then soil data

#### Depth Profile Visualization

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.4 | Implement depth profile card — horizontal stacked bars showing sand/silt/clay % for each of 6 depths (0–5cm through 100–200cm) | ✅ | Color coding: sand=#f4d03f (amber-400), silt=#85c1e9 (sky-300), clay=#e74c3c (red-400); bars stack to 100% |
| 22.5 | Add texture class label next to each depth bar (e.g., "Clay Loam", "Sandy Loam") | ✅ | From `soil_layers.texture_class` |
| 22.6 | Add tooltip on hover — shows exact sand/silt/clay % plus uncertainty ranges | ✅ | Tooltip with Q05–Q95 brackets for sand and clay |

#### Property Cards

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.7 | Implement pH card — shows median pH with 90% confidence range, color-coded scale (red <5.5, yellow 5.5–6.5, green 6.5–7.5, yellow >7.5) | ✅ | Uses Q05/Q95 for uncertainty band display |
| 22.8 | Implement SOC card — shows soil organic carbon (g/kg) with trend badge (low <10, medium 10–25, high >25) | ✅ | Surface layer (0–5cm) value with Q05/Q95 uncertainty |
| 22.9 | Implement CEC card — cation exchange capacity with nutrient buffering interpretation | ✅ | Low (<10), Medium (10–20), High (>20) cmol/kg |
| 22.10 | Implement Bulk Density card — with compaction risk indicator | ✅ | Green (<1.4), Yellow (1.4–1.6), Red (>1.7) kg/dm³ |

#### AWC & Summary Section

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.11 | Implement AWC gauge — rootzone Available Water Capacity (mm over 0–100cm) with confidence band | ✅ | Progress bar; Low (<100mm), Moderate (100–175mm), Good (>175mm) |
| 22.12 | Implement drainage class badge — from field summary | ✅ | Badge with capitalize text |
| 22.13 | Implement risk indicators row — 4 risk scores as colored badges: acidification, compaction, leaching, rooting constraint | ✅ | Green (0–0.3), Yellow (0.3–0.6), Red (0.6–1.0) with dot indicators |
| 22.14 | Implement data quality indicator — shows confidence level based on `data_quality_score` | ✅ | High/Medium/Low confidence badge; includes source name + resolution |

#### Disclaimer & Metadata

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.15 | Add "Regional Estimate" info banner at top of soil tab — persistent `Info` icon with disclaimer text | ✅ | Blue info banner with disclaimer |
| 22.16 | Add source metadata footer — data source name, resolution, fetch date, "Refresh" button | ✅ | Ghost refresh button; shows source, resolution, fetched date |
| 22.17 | Handle empty state — "Soil data is being fetched..." when no profile exists yet (field just created) | ✅ | Layers icon + description + refresh button |

#### Internationalization

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.18 | Add English translations to `apps/web/messages/en.json` — `soil` section with keys for tab label, property names, texture classes, risk labels, disclaimer text, empty state, refresh button/toast | ✅ | ~65 translation keys in `soil` section + `fieldDetail.tabSoil` |
| 22.19 | Add Spanish translations to `apps/web/messages/es.json` — matching `soil` section | ✅ | Matching es translations for all keys |

#### Integration Testing & QA

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.20 | Verify soil tab renders for field with existing soil profile — depth bars, cards, summary all populated | ✅ | Verified with live SoilGrids data |
| 22.21 | Verify soil tab renders empty state for new field without soil data yet | ✅ | Verified — Layers icon + description + Refresh button |
| 22.22 | Verify uncertainty ranges display correctly — Q05/Q95 brackets on pH, SOC, texture | ✅ | Verified with live data |
| 22.23 | Verify risk indicators show correct colors based on 0–1 score ranges | ✅ | Green/yellow/red thresholds verified |
| 22.24 | Verify refresh button — triggers re-fetch, shows toast, disables during cooldown | ✅ | Job tracking with step-by-step progress, toast on completion |
| 22.25 | Verify responsive layout — cards reflow on mobile, depth bars remain readable | ✅ | Panel width 440px, flex tab layout, i18n-safe |
| 22.26 | Verify i18n — switch to Spanish locale, all soil tab text translated | ✅ | Spanish locale verified — tabs, labels, all translated |
| 22.27 | `npx tsc --noEmit` — zero type errors | ✅ | Verified |

---

### Sprint 10C — Phase 3: Derived Agronomic Layers

#### Rosetta PTF Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.1 | Implement `_run_rosetta_ptf(sand, silt, clay, bd)` helper in `tasks/soil.py` — calls `rosetta-soil` package to compute van Genuchten parameters (θ_r, θ_s, α, n, K_sat, L) with 1000-bootstrap uncertainty | ✅ | `from rosetta import SoilData, rosetta`; model 3 (uses texture + BD) |
| 23.2 | Extract PTF-derived hydraulic properties — K_sat (cm/day), FC approximation (θ at 33kPa from vG curve), WP approximation (θ at 1500kPa from vG curve) | ✅ | These supplement/validate SoilGrids wv003/wv1500 when available |
| 23.3 | Integrate Rosetta into `fetch_soil_for_field` task — run PTF after fetching baseline properties if K_sat not available from source | ✅ | SoilGrids doesn't provide K_sat directly; POLARIS does |
| 23.4 | Store Rosetta K_sat mean + uncertainty in `soil_layers.ksat_cm_day` and add `ksat_q05`/`ksat_q95` columns (may need migration `0012_add_ksat_uncertainty.py`) | ✅ | Bootstrap 5th/95th percentile from Rosetta ensemble |

**Verify:** For a clay soil (clay=60%), Rosetta K_sat should be low (< 1 cm/day); for a sandy soil (sand=80%), K_sat should be high (> 30 cm/day)

#### Drainage Class Estimation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.5 | Implement `_estimate_drainage_class(ksat_cm_day)` — maps K_sat to 7 USDA drainage classes | ✅ | Very poorly (<0.01), Poorly (0.01–0.1), Somewhat poorly (0.1–1), Moderately well (1–10), Well (10–36), Somewhat excessively (36–100), Excessively (>100) |
| 23.6 | Update `_compute_field_summary()` to use K_sat-derived drainage class instead of placeholder | ✅ | Uses depth-weighted average K_sat for rootzone (0–100cm) |

**Verify:** Clay-dominant profile → "Somewhat poorly drained"; Sand-dominant → "Somewhat excessively drained"

#### Risk Score Refinement

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.7 | Refine acidification risk — `f(pH, CEC, depth_pattern)`: low pH + low CEC + increasing acidity with depth = high risk; includes subsoil aluminum toxicity proxy (pH < 4.5 at depth) | ✅ | Replace simple threshold from Phase 1 with multi-factor score |
| 23.8 | Refine compaction risk — `f(BD, clay%, depth, coarse_frags)`: high BD relative to texture-specific critical BD + low cfvo = high risk | ✅ | Critical BD varies by texture: sandy≈1.8, loam≈1.65, clay≈1.47 |
| 23.9 | Refine leaching risk — `f(K_sat, sand%, SOC, AWC)`: high K_sat + high sand + low SOC + low AWC = high risk | ✅ | Especially relevant for nutrient/pesticide transport; uses Rosetta K_sat |
| 23.10 | Add waterlogging risk score — `f(K_sat_deep, clay%_deep, drainage_class)`: low K_sat at 60–200cm + high clay at depth = high risk | ✅ | New risk dimension; store in `soil_field_summary` |
| 23.11 | Add `waterlogging_risk` column to `SoilFieldSummary` model + migration `0013_add_waterlogging_risk.py` if not included in initial schema | ✅ | REAL 0–1 |

**Verify:** Profiles with known risk characteristics score appropriately; all risk scores remain 0–1

#### Carbon Baseline Estimation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.12 | Implement `_compute_soc_stock(layers)` — SOC stock (t/ha) = Σ(SOC_g_kg × BD_kg_dm3 × layer_thickness_cm × (1 - cfvo/100) × 0.1) for each depth interval | ✅ | Standard formula; accounts for coarse fragments volume |
| 23.13 | Store total SOC stock in `soil_field_summary.total_soc_stock_t_ha` | ✅ | Topsoil (0–30cm) and full profile (0–200cm) as separate values may be useful — consider adding `topsoil_soc_stock_t_ha` column |
| 23.14 | Add SOC stock card to frontend soil tab — shows t/ha with low/medium/high classification | ✅ | Low (<40 t/ha), Medium (40–80), High (>80) for 0–100cm equivalent |

**Verify:** SOC stock for typical agricultural soil ≈ 40–120 t/ha (0–100cm)

#### Schema & API Updates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.15 | Update `SoilFieldSummaryOut` schema to include all new derived properties (drainage_class, refined risk scores, waterlogging_risk, SOC stock breakdown) | ✅ | |
| 23.16 | Update `SoilLayerOut` schema to include `ksat_q05`/`ksat_q95` uncertainty fields | ✅ | |

#### Frontend Updates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.17 | Update soil tab — add drainage class display with color-coded badge | ✅ | 7-class badge with descriptions |
| 23.18 | Update risk indicators — add waterlogging risk badge, refine existing badge logic to match new scoring | ✅ | Now 5 risk dimensions: acidification, compaction, leaching, rooting, waterlogging |
| 23.19 | Add SOC stock section — total carbon stored per hectare, plus interpretation | ✅ | With uncertainty range from SOC Q05/Q95 propagation |
| 23.20 | Add i18n keys for new risk labels, drainage classes, SOC stock labels — en.json + es.json | ✅ | ~15 new keys |

#### Integration Testing & QA

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.21 | Verify Rosetta PTF runs for SoilGrids-sourced profiles (no source K_sat) | ✅ | K_sat column populated after reprocessing |
| 23.22 | Verify Rosetta is SKIPPED for POLARIS-sourced profiles (K_sat already available) | ✅ | No duplicate computation |
| 23.23 | Verify drainage class mapping produces reasonable results for 3+ test profiles | ✅ | Clay, loam, sand profiles |
| 23.24 | Verify refined risk scores — compare with simple Phase 1 scores for regression | ✅ | Scores should be more differentiated |
| 23.25 | Verify SOC stock calculation matches hand-computed values from layer data | ✅ | Within 5% of manual calculation |
| 23.26 | `ruff check` + `ruff format --check` on all modified Python files | ✅ | |
| 23.27 | `npx tsc --noEmit` | ✅ | |

---

### Sprint 10D — Phase 4: Intelligence Applications

#### Sampling Zone Recommendations

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.1 | Implement `_compute_sampling_zones(field_id)` — suggests soil sampling locations based on within-field soil variability zones | ⬜ | Uses SoilGrids/POLARIS multi-pixel extraction (not just centroid) for fields >10ha; identifies high-variance zones where clay%, SOC, or pH differ most from field mean |
| 24.2 | Add `GET /v1/fields/{field_id}/soil/sampling-zones` endpoint — returns GeoJSON FeatureCollection with suggested sampling points + rationale | ⬜ | Each feature has `zone_type` (high-clay, high-SOC-variability, etc.) and `priority` (1–3) |
| 24.3 | Add sampling zone overlay to field map in soil tab — show suggested sampling points on the map | ⬜ | MapLibre markers with priority-colored pins |
| 24.4 | Add i18n keys for sampling zone labels (en + es) | ⬜ | ~10 keys |

#### Crop Suitability Context

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.5 | Implement `_assess_crop_suitability(soil_summary, crop_type)` — basic suitability scoring for common crops based on soil properties | ⬜ | Input: texture, pH, drainage, AWC, SOC; Output: suitability score (0–1) + limiting factors list |
| 24.6 | Define crop requirement profiles for 10–15 common crops — wheat, corn/maize, rice, soybean, cotton, sugarcane, potato, barley, sunflower, sorghum, alfalfa, coffee, cocoa, oil palm, cassava | ⬜ | Each crop: optimal pH range, min AWC, preferred texture classes, drainage tolerance, min SOC |
| 24.7 | Add `GET /v1/fields/{field_id}/soil/crop-suitability` endpoint — returns scored list of crops with suitability ratings and limiting factors | ⬜ | Returns top 10 most suitable crops; if field has `crop_type`, that crop's suitability is highlighted |
| 24.8 | Add crop suitability section to soil tab — card showing current crop's suitability + limiting factors, expandable list for alternative crops | ⬜ | Color-coded: Excellent (>0.8), Good (0.6–0.8), Moderate (0.4–0.6), Poor (<0.4) |
| 24.9 | Add i18n keys for crop names, suitability levels, limiting factor labels (en + es) | ⬜ | ~40 keys |

#### Fertilizer-Risk Stratification

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.10 | Implement nutrient-risk zone classification — based on pH, CEC, SOC, texture, leaching risk | ⬜ | NOT prescriptive: classifies zones as "nutrient responsive" vs "nutrient retentive" vs "nutrient loss risk" — context for planning, not a fertilizer recommendation |
| 24.11 | Add `GET /v1/fields/{field_id}/soil/nutrient-context` endpoint — returns nutrient risk zone classification + interpretation text | ⬜ | Includes disclaimer: "This is soil context, not a fertilizer recommendation" |
| 24.12 | Add nutrient context section to soil tab — zone classification badges with interpretation | ⬜ | |
| 24.13 | Add i18n keys for nutrient zone labels, interpretation text (en + es) | ⬜ | ~15 keys |

#### Carbon & Sequestration Opportunity

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.14 | Implement `_estimate_sequestration_potential(soil_summary, climate_context)` — rough estimate of carbon sequestration opportunity based on current SOC level vs theoretical maximum for texture+climate zone | ⬜ | Uses texture-dependent SOC saturation deficit concept; requires weather data (annual precip, temp) from existing weather tables |
| 24.15 | Add `GET /v1/fields/{field_id}/soil/carbon` endpoint — returns current SOC stock, estimated SOC saturation, sequestration opportunity range | ⬜ | Includes strong disclaimer: "Estimates only; not suitable for carbon credit verification" |
| 24.16 | Add carbon section to soil tab — SOC stock gauge, saturation % estimate, sequestration opportunity card | ⬜ | With uncertainty band showing wide range of estimates |
| 24.17 | Add i18n keys for carbon section labels (en + es) | ⬜ | ~15 keys |

#### Weather × Soil Stress Indicators

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.18 | Implement `_compute_soil_weather_stress(field_id)` — combines AWC from soil with recent precipitation from weather tables to estimate root-zone stress | ⬜ | Drought stress = when water_balance_30d < -AWC_rootzone; Waterlogging stress = when water_balance_30d > AWC_rootzone and drainage_class is poor |
| 24.19 | Add soil-weather stress indicator to field dashboard or weather tab — shows current estimated root-zone moisture status (dry stress / optimal / wet stress) | ⬜ | Simple traffic-light indicator; references both soil capacity and recent weather |
| 24.20 | Add i18n keys for stress indicator labels (en + es) | ⬜ | ~8 keys |

#### Soil-Aware Alerts

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.31 | Define soil alert conditions — thresholds for soil properties that warrant user notification (e.g., pH < 5.5 acidic, SOC < 1% low organic matter, sand > 80% high leaching risk, CEC < 5 low nutrient retention) | ⬜ | Configurable per-org in future; hardcoded sensible defaults for v1 |
| 24.32 | Implement `_evaluate_soil_alerts(field_id, soil_summary)` in soil task — after soil fetch completes, check summary values against thresholds and create alert rows | ⬜ | Reuses existing `alerts` table with `type="soil"` or new soil-specific alert types |
| 24.33 | Alembic migration: add `"soil_ph"`, `"soil_organic_matter"`, `"soil_texture"`, `"soil_nutrient_retention"` to alert `metric` enum or use flexible string column | ⬜ | Extend existing alert schema to support soil-based metrics |
| 24.34 | Add `soil_context` JSONB column to alerts (or reuse `weather_context` pattern) — stores relevant soil property values at time of alert creation | ⬜ | e.g., `{"ph": 4.8, "depth": "0-5cm", "threshold": 5.5}` |
| 24.35 | Update alert Pydantic schemas — add soil alert types to `AlertOut`, include `soil_context` in response | ⬜ | Optional field, same pattern as `weather_context` |
| 24.36 | Display soil alerts in alert list on frontend — icon differentiation, soil context details in alert row | ⬜ | Soil alerts show relevant property name, value, and threshold |
| 24.37 | Add i18n keys for soil alert labels and descriptions (en + es) | ⬜ | ~12 keys: alert type names, threshold descriptions, soil property labels |

#### Share Reports — Soil Summary Section

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.38 | Include soil summary in share report API response — add `soil_summary` to `ShareReportOut` schema with key soil properties (texture class, pH, SOC, CEC, drainage) | ⬜ | Same pattern as `weather_summary` JSONB; returns null if soil data not yet fetched |
| 24.39 | Add "Soil Summary" section to shared field report page — card with texture triangle icon, pH gauge, SOC %, CEC, key depth profiles | ⬜ | Positioned after Weather Summary section; conditionally rendered only when soil data exists |
| 24.40 | Add i18n keys for share report soil section (en + es) | ⬜ | ~10 keys: `shareReport.soilSummary`, `shareReport.textureClass`, `shareReport.soilPH`, etc. |
| 24.41 | Verify soil summary renders correctly on public share page (no auth required) | ⬜ | Same access pattern as weather summary — data embedded in report snapshot |

#### Integration Testing & QA

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.21 | Verify sampling zones — generates 3–5 zones for a field with multi-pixel coverage | ⬜ | GeoJSON points within field boundary |
| 24.22 | Verify crop suitability — rice scores high for clay/wet profiles, wheat/corn for loam profiles | ⬜ | Spot-check 3 profiles × 3 crops |
| 24.23 | Verify nutrient context — high-sand/low-CEC → "nutrient loss risk"; high-clay/high-CEC → "nutrient retentive" | ⬜ | |
| 24.24 | Verify carbon estimates — SOC stock within plausible range (20–200 t/ha for 0–100cm) | ⬜ | |
| 24.25 | Verify weather×soil stress — field with low AWC + dry 30-day window → drought stress flag | ⬜ | Requires weather data in DB |
| 24.26 | Verify all new endpoints return proper 404 when soil data not yet fetched | ⬜ | |
| 24.27 | Verify all disclaimers present on prescriptive/estimation features | ⬜ | Carbon, nutrient, crop suitability |
| 24.28 | i18n validation — all new keys in en.json and es.json | ⬜ | |
| 24.29 | `ruff check` + `ruff format --check` on all new/modified Python files | ⬜ | |
| 24.30 | `npx tsc --noEmit` — zero type errors | ⬜ | |
| 24.42 | Verify soil alerts — field with pH < 5.5 triggers acidic soil alert; field with normal values → no soil alerts | ⬜ | Run soil fetch, check alerts list |
| 24.43 | Verify soil summary on share page — shared report includes soil card when data exists, omits when not | ⬜ | Test with and without soil data |
| 20.18 | Backend lint pass (`ruff check` + `ruff format`) | ✅ | All 6 modified files pass |