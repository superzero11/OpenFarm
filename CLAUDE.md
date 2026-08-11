# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# OpenFarm

Open source crop intelligence platform. Fuses satellite (Sentinel-2), weather (Open-Meteo), and soil (SoilGrids/POLARIS) data into per-field insights. BSD-3-Clause. Repo: https://github.com/superzero11/OpenFarm

Deeper docs: ARCHITECTURE.md (3-layer strategic architecture), docs/openfarm.md (full PRD), DEPLOYMENT.md, ROADMAP.md. `.github/copilot-instructions.md` mirrors much of this file — keep them in sync when conventions change.

## Monorepo layout

```
apps/web/         Next.js 14 (App Router) + NextAuth + Tailwind + shadcn/ui + MapLibre + ECharts
services/api/     FastAPI + SQLAlchemy 2.0 (async) + Alembic + Celery tasks
services/tiler/   TiTiler COG tile server with JWT auth (shared OPENFARM_JWT_SECRET)
deploy/           VPS setup + backup scripts
docker-compose.yml            Postgres/PostGIS 16, Redis 7, MinIO, api, worker, tiler, web
docker-compose.dev.yml        dev overrides
docker-compose.prod.yml       prod overrides (Caddy auto-SSL, see Caddyfile + DEPLOYMENT.md)
```

## Commands

### Frontend (apps/web)
```bash
npm install
npm run dev          # dev server on :3000
npm run lint         # ESLint — must pass before PR
npm run type-check   # tsc --noEmit — must pass before PR
npm run build        # runs lint + type-check first, then next build
```
Node 20 / npm 10 (CI pins Node 20).

### Backend (services/api)
```bash
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
ruff check .              # must pass before PR
ruff format --check .     # must pass before PR
```
Python 3.11 (CI pins it; CI also apt-installs gdal-bin).

### Migrations
```bash
cd services/api
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```
Migrations are numbered sequentially (0001–0013 so far). Keep that convention. In Docker, the API container runs `alembic upgrade head` automatically at startup (services/api/Dockerfile CMD) — local dev must run it manually.

### Full stack
```bash
cp .env.example .env   # fill GOOGLE_CLIENT_ID/SECRET, generate NEXTAUTH_SECRET + OPENFARM_JWT_SECRET
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
Web :3000 · API :8000 (/docs Swagger) · TiTiler :8080 · MinIO console :9001
Health checks: `curl :8000/healthz` (API), `curl :3000/api/health` (web).

## Architecture essentials

- **Data-flow boundary:** Next.js talks to Postgres directly **only** for user upsert during the NextAuth callback (apps/web/src/lib/db.ts). All other frontend data flows through the FastAPI API via the typed client in apps/web/src/lib/api.ts (SWR for fetching; namespaced helpers like `farmsApi.list()`, `fieldsApi.create()`).
- **Auth flow:** Google OAuth via NextAuth → session cookie → `POST /api/auth/token` (apps/web/src/app/api/auth/token/route.ts) mints a 1-hour HS256 API JWT → frontend caches it (apps/web/src/lib/api.ts, re-mints with 60s headroom). API, tiler, and web all verify with the same `OPENFARM_JWT_SECRET`.
- **Org scoping / RBAC:** dependency chain in services/api/app/middleware/auth.py: `get_current_user` (JWT) → `get_org_context` (X-Org-Id header + OrgMember lookup) → `require_roles("owner","admin","member")`. Every org-scoped endpoint must use this chain. Roles: owner | admin | member | viewer (viewer = read-only). Org-scoped tables carry a denormalized `org_id` column for tenant isolation.
- **API conventions:** all routes under `/v1`; pagination envelope `{items, total, limit, offset}` (`PaginatedResponse[T]` in schemas/common.py); soft delete via `deleted_at` — always filter with `.where(Model.deleted_at.is_(None))`; geometry stored as `MultiPolygon(4326)` with auto-wrap of Polygons (`_geojson_to_multi` in routers/fields.py); audit events on key actions.
- **Models:** all ORM tables live in services/api/app/models/tables.py, UUID PKs with `server_default=uuid_generate_v4()`. Pydantic schemas in schemas/ use `model_config = {"from_attributes": True}`.
- **Satellite pipeline:** shared helpers in services/api/app/tasks/pipeline.py (STAC search on Element84 earth-search → windowed band reads → index compute → COG write to MinIO → zonal stats → alert evaluation). Index definitions in tasks/indices.py (NDVI, EVI, SAVI, NDWI). Backfill = 24 months in 90-day chunks (tasks/backfill.py). MAX_CLOUD_COVER=20 module constant.
- **Celery:** worker config in app/worker.py — acks_late, visibility_timeout 7200, task_time_limit 1800. ML detection tasks route to the `ml` queue and only register when torchgeo imports (the ml-processor container). Beat: weekly index compute (Mon 06:00), daily weather fetch (08:00). Long-running jobs report per-step progress via the `jobs.progress_json` JSONB column.
- **Weather pipeline:** tasks/weather.py — Open-Meteo API, 18 daily variables plus 5 derived agronomic indices (GDD, ET₀, water balance, drought index), upserted into weather_daily.
- **Boundary detection:** tasks/detection.py, FTW model via ftw-tools. Note the torchgeo monkey-patch at the top (AugmentationSequential from kornia) — required for ftw-tools 1.4.3 with torchgeo ≥0.7; remove when upstream fixes.
- **Soil intelligence:** core/soil_intelligence.py (~2,300 lines, pure functions + frozen dataclasses): 68 crop profiles, 4-pillar suitability scoring (Soil 40 / Water 25 / Climate 20 / Stress 15), sampling zones, carbon sequestration, nutrient risk, soil×weather stress. Data ingestion in tasks/soil.py (SoilGrids WCS global 250m, POLARIS US 30m).
- **Share links:** routers/share.py — `secrets.token_urlsafe(32)` tokens; public tile proxy validates the share token then mints a 5-minute service JWT (`sub: "service:share-proxy"`) for internal TiTiler calls.
- **Rate limiting:** slowapi, 120/min default, keyed by JWT sub falling back to IP (core/rate_limit.py), Redis-backed.
- **Frontend structure:** routes use a `[locale]` segment (next-intl, `localePrefix: "as-needed"`); `(authenticated)/layout.tsx` enforces session server-side, and `AppShell` wraps authenticated pages with `OrgProvider` (org switching via `useOrg()`, active org ID in localStorage) + Sidebar. Maps go through the `BaseMap`/`DrawMap` MapLibre components (PMTiles basemap with OSM fallback).
- **Frontend i18n:** next-intl, en + es in apps/web/messages/. All user-facing strings go through message files — never hardcode.

## Changelog rules

CHANGELOG.md is rendered in-app at `/changelog` by a minimal parser (`parseChangelog` in apps/web changelog/page.tsx). List items are output as raw text — `**bold**`, `` `backticks` ``, and `[links](url)` display literally. Use only `## [version] - YYYY-MM-DD` headers, `### Added/Fixed/Changed/Security/Deprecated/Removed` sections, and plain-text `- items`. Write for non-technical users: no file paths, migration names, function names, or endpoint paths.

## Style

- Python: ruff (lint + format), type hints throughout, async SQLAlchemy in routers, sync sessions only inside Celery tasks (core/database_sync.py).
- TypeScript: strict; typed API client in apps/web/src/lib/api.ts — add new endpoint wrappers + interfaces there, don't fetch ad hoc.
- UI primitives from apps/web/src/components/ui/ (shadcn); charts in components/charts/; field tabs in components/field/.
- Structured logging: structlog (Python), pino-style logger in apps/web/src/lib/logger.ts. No print/console.log.

## Known issues / priority backlog

1. **No tests.** CI runs `echo "No tests yet"`. Highest priority. Start with core/soil_intelligence.py (pure functions, easy wins, correctness matters agronomically), then middleware/auth.py (get_org_context, require_roles). Add pytest to `[dev]` extras and wire into .github/workflows/ci.yml.
2. **Secret default fallbacks.** `"change-me"` fallback for OPENFARM_JWT_SECRET exists in three places: services/api/app/core/config.py, services/tiler/app.py, apps/web/src/app/api/auth/token/route.ts. All three services agree on the default, so a misconfigured deploy silently works with a known secret. Fail hard at startup when unset outside dev.
3. **Tile proxy SSRF surface.** proxy_share_tile / TiTiler `url=` param ultimately reach GDAL. Add an explicit allowlist check that dataset URLs come only from our MinIO endpoint / raster_layers rows.
4. **Service JWT scope.** The share-proxy service token has no `aud` claim; it verifies against the main API too (only failing accidentally at `uuid.UUID(sub)`). Add per-service audience claims and check them.
5. **`/healthz` always returns HTTP 200**, even with `status: "unhealthy"`. Return 503 on errors so orchestrators notice.
6. **Hardcoded `worker_concurrency=4`** in app/worker.py — make env-configurable (target deploy is a 2-OCPU/12GB Oracle Ampere ARM free-tier VM, so 4 is likely too high there).
7. Minor: MAX_CLOUD_COVER should become per-org/per-field configurable; the Discord invite link in README (discord.gg/spPhvA2u) is dead — Discord's API returns "Unknown Invite"; replace it with a valid permanent invite.

## Deployment context

Target: Oracle Cloud Always Free (Ampere A1 ARM, 2 OCPU / 12 GB). See DEPLOYMENT.md. Open questions: ARM wheel availability for GDAL/rasterio/torchgeo; rate-limit or disable ML inference for anonymous demo users.

## Do not

- Bypass the get_org_context/require_roles chain on any org-scoped endpoint.
- Commit secrets or weaken the JWT verification shared across api/tiler/web.
- Add heavyweight deps to the base API image — ML-only deps belong in requirements-ml.txt / Dockerfile.ml.
- Break the pagination envelope or `/v1` prefix conventions.