# OpenFarm - Copilot Instructions

## Architecture Overview

OpenFarm is an open, modular field intelligence platform built on a **3-layer strategic architecture** (see `ARCHITECTURE.md`):

- **Layer A - Observation Infrastructure** (Data Gravity): satellite imagery, weather, soil profiles, field boundaries, sensors
- **Layer B - Intelligence Engine** (Moat): anomaly detection, stress signals, risk models, explainability
- **Layer C - Delivery Surfaces** (Distribution): map UI, reports, API, scouting, integrations

### Tech Stack

- **`apps/web/`** - Next.js 14 + NextAuth (Google OAuth) + Tailwind + shadcn/ui + MapLibre + ECharts
- **`services/api/`** - FastAPI + SQLAlchemy 2.0 (async) + Alembic + Pydantic v2
- **`services/tiler/`** - TiTiler (COG tile server) with shared JWT auth
- **Infrastructure** - PostgreSQL 16 + PostGIS 3.4, Redis 7 (Celery broker), MinIO (S3-compatible), Docker Compose

**Critical rule:** Next.js talks to Postgres **only** for user upsert during NextAuth auth callback (`src/lib/db.ts`). All other data flows through the FastAPI API via `src/lib/api.ts`.

## Auth Flow

1. User signs in via Google OAuth (NextAuth) → `upsertUser()` in `lib/db.ts` creates user + default org directly in Postgres
2. Client calls `POST /api/auth/token` to mint a short-lived API JWT (HS256, 1hr TTL, shared `OPENFARM_JWT_SECRET`)
3. `apiFetch()` in `lib/api.ts` auto-manages JWT caching/re-minting and injects `Authorization` + `X-Org-Id` headers
4. API routes use `get_current_user` (JWT validation) and `get_org_context` (org membership check via `X-Org-Id` header) as FastAPI dependencies
5. RBAC via `require_roles("owner", "admin", ...)` dependency factory in `middleware/auth.py`

## API Conventions

- All endpoints prefixed with `/v1` - routers in `services/api/app/routers/`
- Org-scoped resources require `X-Org-Id` header; validated by `get_org_context` dependency
- Pagination uses `PaginatedResponse[T]` envelope: `{ items, total, limit, offset }` (see `schemas/common.py`)
- Soft-delete pattern: `deleted_at` timestamp column, filter with `.where(Model.deleted_at.is_(None))`
- All org-scoped tables have denormalized `org_id` column for tenant isolation
- Geometry stored as `MultiPolygon(4326)` - auto-wrap `Polygon` to `MultiPolygon` in `_geojson_to_multi()` helper
- Schemas in `schemas/` use `model_config = {"from_attributes": True}` for ORM → Pydantic conversion
- Audit events created on significant actions (field_created, etc.) per PRD Section 5.1

## Database & Migrations

- ORM models in `services/api/app/models/tables.py` - all tables use UUID PKs with `server_default=uuid_generate_v4()`
- Async engine (`asyncpg`) for FastAPI in `core/database.py`; sync engine (`psycopg2`) for Celery in `core/database_sync.py`
- Migrations: `cd services/api && alembic revision --autogenerate -m "desc" && alembic upgrade head`
- Auto-runs `alembic upgrade head` on API startup

## Celery / Background Jobs

- Worker config in `services/api/app/worker.py` - broker=Redis, JSON serialization, 30min hard timeout
- Tasks in `services/api/app/tasks/` - `ndvi.py` (vegetation indices), `soil.py` (soil profile ingestion), `weather.py` (weather data), `backfill.py` (historical index backfill)
- Celery workers use sync SQLAlchemy sessions (`core/database_sync.py`), not async
- Vegetation pipeline: STAC search → download bands → compute index (NDVI/EVI/SAVI/NDWI) → write COG to MinIO → zonal stats → alert evaluation
- Soil pipeline: SoilGrids WCS (global) or POLARIS S3 (US) → 10 properties × 6 depths → texture classification → risk scoring → field summary
- Weather pipeline: Open-Meteo API → 18 variables + 5 derived indices (GDD, ET₀, water balance, drought) → daily upsert
- Job progress tracked via `jobs.progress_json` JSONB column with per-step status updates

## Writing Style (strict)

Applies to docs, comments, UI strings, commit messages, and script output:

- No em-dashes (use hyphens, commas, or restructure)
- No emojis or decorative unicode symbols anywhere
- No AI-filler phrasing ("seamless", "leverage", "delve", "robust", "empower", and similar)
- UI icons come exclusively from lucide-react; never emoji or unicode symbols as icons

## Frontend Patterns

- **i18n**: `next-intl` with `en`/`es` locales; messages in `apps/web/messages/`. Routes use `[locale]` segment with `localePrefix: "as-needed"`
- **UI components**: shadcn/ui in `src/components/ui/` (Radix primitives + Tailwind + `class-variance-authority`)
- **Org context**: `OrgProvider` + `useOrg()` hook in `org-context.tsx` manages org switching; org ID stored in `localStorage`
- **Map**: MapLibre GL JS via `BaseMap` and `DrawMap` components; PMTiles protocol for basemap tiles with OSM fallback
- **Charts**: Apache ECharts via `echarts-for-react` (see `components/charts/ndvi-chart.tsx`)
- **State/fetching**: SWR for data fetching; API client in `lib/api.ts` exposes namespaced helpers (e.g., `farmsApi.list()`, `fieldsApi.create()`)
- **Auth pages**: `(authenticated)/layout.tsx` checks session server-side → redirects unauthenticated users. `AppShell` wraps authenticated pages with `OrgProvider` + `Sidebar`

## Development Commands

```bash
# Full stack (Docker - dev mode with localhost ports)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# API only (local dev)
cd services/api && pip install -e ".[dev]" && uvicorn app.main:app --reload --port 8000

# Web only (local dev)
cd apps/web && npm install && npm run dev

# Database migration
cd services/api && alembic revision --autogenerate -m "description" && alembic upgrade head

# Health checks
curl http://localhost:8000/healthz   # API
curl http://localhost:3000/api/health # Web
```

## Key Files Reference

| Purpose | Path |
|---|---|
| API entry + routers | `services/api/app/main.py` |
| Auth dependencies | `services/api/app/middleware/auth.py` |
| ORM models (all tables) | `services/api/app/models/tables.py` |
| Pydantic schemas | `services/api/app/schemas/` |
| NDVI processing pipeline | `services/api/app/tasks/ndvi.py` |
| Config (pydantic-settings) | `services/api/app/core/config.py` |
| Frontend API client | `apps/web/src/lib/api.ts` |
| NextAuth + user upsert | `apps/web/src/lib/auth.ts`, `apps/web/src/lib/db.ts` |
| Org context provider | `apps/web/src/components/org-context.tsx` |
| i18n routing config | `apps/web/src/i18n/routing.ts` |
| Docker Compose (base services) | `docker-compose.yml` |
| Dev port overrides | `docker-compose.dev.yml` |
| Prod overrides (Caddy, limits) | `docker-compose.prod.yml` |
| Strategic architecture | `ARCHITECTURE.md` |
| PRD (full product spec) | `docs/openfarm.md` |

## Changelog Guidelines

`CHANGELOG.md` is rendered in-app at `/changelog` for end users. The parser (`parseChangelog` in `changelog/page.tsx`) only supports these constructs:

- `## [version] - YYYY-MM-DD` - version header
- `### Added` / `### Fixed` / `### Changed` / `### Security` / `### Deprecated` / `### Removed` - section badges
- `- plain text item` - list items rendered as **plain text** (no markdown processing)

**Rules for writing changelog entries:**

1. Items are output as raw text in `<li>` tags - `**bold**`, `` `backticks` ``, and `[links](url)` will display literally, not formatted. Do not use any inline markdown.
2. Write for non-technical users: describe what features do, not how they are built.
3. Do not include internal file paths, migration names, function names, API endpoint paths, or config keys.
4. Keep items as clean, descriptive sentences. Match the style of existing entries (e.g., v0.1.0).
5. Use the section headings that map to badge colors: Added (green), Fixed (blue), Changed (yellow), Security (red), Deprecated (orange), Removed (gray).
