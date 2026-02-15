# Contributing to OpenFarm

Thank you for your interest in contributing to OpenFarm! Whether it's a bug fix, new feature, documentation improvement, or feedback — every contribution matters. This guide covers everything you need to get up and running.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Architecture Rules](#architecture-rules)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Database Migrations](#database-migrations)
- [Internationalization (i18n)](#internationalization-i18n)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Questions & Discussions](#questions--discussions)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to **hello@openfarm.earth**.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/OpenFarm.git
   cd OpenFarm
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/superzero11/OpenFarm.git
   ```
4. **Enable pre-commit hooks** (runs lint + type-check before each commit):
   ```bash
   git config core.hooksPath .husky
   ```
5. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker & Docker Compose | v2+ | Full-stack orchestration |
| Node.js | 20+ | Frontend development |
| npm | 10+ | Package management |
| Python | 3.11+ | Backend development |
| pip | latest | Python package management |
| Google OAuth credentials | — | [Setup guide](https://console.cloud.google.com/apis/credentials) |

### Option 1: Full Stack via Docker (recommended for first run)

```bash
# 1. Copy and configure environment
cp .env.example .env

# 2. Generate secrets
openssl rand -base64 32   # → paste as NEXTAUTH_SECRET
openssl rand -base64 64   # → paste as OPENFARM_JWT_SECRET

# 3. Edit .env — fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

# 4. Start everything
docker compose up --build
```

Services will be available at:

| Service | URL | Purpose |
|---|---|---|
| Web UI | http://localhost:3000 | Frontend |
| API (Swagger) | http://localhost:8000/docs | Interactive API docs |
| TiTiler | http://localhost:8080 | COG tile server |
| MinIO Console | http://localhost:9001 | Object storage admin |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Queue broker |

Verify everything is healthy:

```bash
curl http://localhost:8000/healthz    # API
curl http://localhost:8080/healthz    # TiTiler
curl http://localhost:3000/api/health # Web
```

### Option 2: Frontend Only (local dev)

```bash
cd apps/web
npm install
npm run dev            # → http://localhost:3000
npm run lint           # ESLint checks
npm run type-check     # TypeScript strict mode
```

> **Note:** You'll need the API running (via Docker or locally) for the frontend to function fully.

### Option 3: API Only (local dev)

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

> **Note:** Requires PostgreSQL + PostGIS and Redis running locally or via Docker.

---

## Project Structure

```
openfarm/
├── apps/web/                → Next.js 14 frontend
│   ├── src/
│   │   ├── app/             → App Router pages & layouts
│   │   ├── components/      → React components (UI, map, charts)
│   │   ├── i18n/            → Internationalization config
│   │   ├── lib/             → API client, auth, utilities
│   │   └── types/           → TypeScript type declarations
│   └── messages/            → i18n translation files (en.json, es.json)
├── services/api/            → FastAPI backend
│   ├── app/
│   │   ├── core/            → Config, database engines, logging
│   │   ├── middleware/       → JWT auth + RBAC dependencies
│   │   ├── models/          → SQLAlchemy ORM models (all 13 tables)
│   │   ├── routers/         → API route handlers
│   │   ├── schemas/         → Pydantic v2 request/response schemas
│   │   ├── tasks/           → Celery background tasks (NDVI pipeline)
│   │   └── worker.py        → Celery app configuration
│   └── alembic/             → Database migration scripts
├── services/tiler/          → TiTiler COG tile server (shared JWT auth)
├── docker-compose.yml       → Full stack orchestration
├── .env.example             → Environment variable template
└── docs/                    → Internal documentation (not in repo)
```

---

## Architecture Rules

These are **strict invariants** — please follow them in all contributions:

1. **Next.js ↔ Postgres isolation:** The Next.js app talks to Postgres **only** for user upsert during the NextAuth auth callback (`src/lib/db.ts`). All other data flows through the FastAPI API via `src/lib/api.ts`.

2. **API calls:** Always use `apiFetch()` from `lib/api.ts` — never call the API directly with `fetch()`.

3. **Org-scoped resources:** All org-scoped API endpoints require the `X-Org-Id` header, validated by the `get_org_context` dependency.

4. **Soft-delete pattern:** Use `deleted_at` timestamp — filter with `.where(Model.deleted_at.is_(None))`.

5. **UUID primary keys:** All tables use UUID PKs with `server_default=uuid_generate_v4()`.

6. **Geometry:** Stored as `MultiPolygon(4326)` — auto-wrap `Polygon` inputs to `MultiPolygon` using the `_geojson_to_multi()` helper.

7. **No hardcoded URLs or secrets:** Everything via environment variables.

---

## Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** — keep commits focused and atomic.

3. **Test locally** — ensure the full stack runs:
   ```bash
   docker compose up --build
   ```

4. **Lint and type-check** before pushing:
   ```bash
   # Frontend
   cd apps/web
   npm run lint
   npm run type-check

   # Backend
   cd services/api
   ruff check .
   ruff format --check .
   mypy app/ --ignore-missing-imports
   ```

5. **Build** to catch production issues:
   ```bash
   # Frontend production build
   cd apps/web && npm run build

   # Docker full-stack build
   docker compose build
   ```

---

## Code Style

### Python (services/api, services/tiler)

| Aspect | Standard |
|--------|----------|
| Formatter / Linter | [Ruff](https://docs.astral.sh/ruff/) (configured via `pyproject.toml`) |
| Type hints | Required on all function signatures |
| Line length | 88 characters (Ruff default) |
| Imports | Sorted by Ruff (`isort`-compatible) |

- **Async:** FastAPI routes use `async def` with `AsyncSession`; Celery tasks use sync sessions (`database_sync.py`)
- **Schemas:** Pydantic v2 with `model_config = {"from_attributes": True}` for ORM conversion
- **Logging:** `structlog` — use structured key-value pairs, not string interpolation:
  ```python
  # ✅ Good
  logger.info("farm_created", farm_id=str(farm.id), org_id=str(ctx.org_id))

  # ❌ Bad
  logger.info(f"Farm {farm.id} created in org {ctx.org_id}")
  ```

### TypeScript (apps/web)

| Aspect | Standard |
|--------|----------|
| Linter | ESLint (Next.js config) |
| Type checking | TypeScript strict mode |
| Styling | Tailwind CSS + `cn()` utility from `lib/utils.ts` |
| Components | React Server Components by default; add `"use client"` only when needed |

- **API calls:** Always use `apiFetch()` from `lib/api.ts` — never `fetch()` directly
- **i18n:** All user-facing strings must be in `messages/en.json` and `messages/es.json`
- **Imports:** Use `@/*` path alias (maps to `./src/*`)

### General

- No `console.log` in production code (use proper logging)
- No `any` types in TypeScript unless absolutely unavoidable (with a `// eslint-disable` comment explaining why)
- Prefer named exports over default exports
- Keep files focused — one component/module per file

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer — e.g., Closes #123]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`

**Scopes:** `web`, `api`, `tiler`, `docker`, `db`, `ci`

**Examples:**
```
feat(api): add field boundary import from KML
fix(web): handle expired JWT token refresh
docs: update README with self-hosting guide
chore(docker): pin PostGIS image version
ci: add lint and type-check to CI pipeline
perf(api): add index on fields.org_id for tenant queries
```

---

## Pull Request Process

### Before Opening a PR

1. **Rebase** on latest `main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. **Run all checks** locally:
   ```bash
   # Frontend
   cd apps/web && npm run lint && npm run type-check && npm run build

   # Backend
   cd services/api && ruff check . && ruff format --check .
   ```
3. **Push** your branch and open a PR against `main`

### PR Checklist

- [ ] PR has a clear title following conventional commit format
- [ ] Description explains **what** changed and **why**
- [ ] Lint, type-check, and build pass
- [ ] Screenshots included for UI changes
- [ ] `messages/en.json` and `messages/es.json` updated if adding user-facing strings
- [ ] Database migration added if schema changed (`alembic revision --autogenerate`)
- [ ] Related issue referenced with `Closes #123` or `Fixes #123`

### Review Process

1. A maintainer will review your PR (usually within 48 hours)
2. Address feedback via additional commits (no force-push during review)
3. Once approved, the maintainer will squash-and-merge

### PR Size Guidelines

- **Small PRs** (< 300 lines) are reviewed faster and merged sooner
- Split large features into stacked PRs when possible
- One feature or fix per PR — avoid bundling unrelated changes

---

## Database Migrations

When you modify ORM models in `services/api/app/models/tables.py`:

```bash
cd services/api

# 1. Generate migration
alembic revision --autogenerate -m "describe your change"

# 2. Review the generated file in alembic/versions/
# 3. Apply migration
alembic upgrade head
```

**Migration rules:**
- Always review auto-generated migrations — they may miss some changes
- Never modify an existing migration that has been merged to `main`
- Include both `upgrade()` and `downgrade()` functions
- Test the full upgrade + downgrade cycle locally

---

## Internationalization (i18n)

OpenFarm uses `next-intl` with `en` and `es` locales.

- Translation files: `apps/web/messages/en.json` and `apps/web/messages/es.json`
- Routes use the `[locale]` segment with `localePrefix: "as-needed"`
- **All user-facing strings must be translated** — no hardcoded English in components

When adding new strings:

1. Add the key to **both** `en.json` and `es.json`
2. Use the `useTranslations()` hook in client components
3. Use `getTranslations()` in server components

---

## Testing

### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] Full stack starts cleanly with `docker compose up --build`
- [ ] Health endpoints respond: `/healthz` (API), `/api/health` (Web)
- [ ] Google OAuth sign-in flow works end-to-end
- [ ] Core workflows function: create farm → add field → trigger NDVI job
- [ ] No console errors in browser DevTools
- [ ] No unhandled exceptions in API logs

### Automated Checks (CI)

The CI pipeline runs on every PR:

- **Frontend:** `npm run lint` → `npm run type-check`
- **Backend:** `ruff check .` → `ruff format --check .`

All checks must pass before merge.

---

## Reporting Issues

Use [GitHub Issues](../../issues) with the provided templates:

- **Bug reports:** Include steps to reproduce, expected vs actual behavior, environment details, and relevant logs
- **Feature requests:** Describe the use case, proposed solution, and any alternatives considered

---

## Security Vulnerabilities

**Do NOT open a public issue for security vulnerabilities.**

Please see [SECURITY.md](SECURITY.md) for our responsible disclosure policy.

---

## Questions & Discussions

- Open a [Discussion](../../discussions) for questions, ideas, or general feedback
- Join the conversation — we're happy to help you get started

---

Thank you for contributing to OpenFarm! Every contribution helps bring transparent, affordable crop intelligence to farms everywhere. 🌾
