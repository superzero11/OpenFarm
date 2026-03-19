# Changelog

All notable changes to OpenFarm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

---

## [0.8.0] - 2026-03-19

### Added
- **Soil intelligence engine** — 2,200+ lines of agronomic logic in `core/soil_intelligence.py` powering crop suitability, nutrient analysis, carbon estimation, sampling recommendations, and stress monitoring.
- **Crop suitability assessment** — 4-pillar weighted scoring system: Soil Fit (40%), Water Match (25%), Climate Fit (20%), Stress Resilience (15%) with 68 crop profiles spanning cereals, legumes, industrial crops, root/tuber, vegetables, fruits, plantations, and spices.
- Weather-aware crop suitability — integrates annual rainfall, temperature range, drought/flood indices from `weather_daily`; requires ≥180 days of weather data.
- `GET /fields/{id}/soil/crop-suitability` endpoint — returns top 10 most suitable crops with scores, ratings, and limiting factors; field's current crop type highlighted even if outside top 10.
- **Sampling zone recommendations** — within-field soil variability analysis identifies locations where clay%, SOC, pH, or AWC differ most from field mean.
- `GET /fields/{id}/soil/sampling-zones` endpoint — returns GeoJSON FeatureCollection with prioritized sampling points (P1–P3) and rationale.
- **Nutrient risk classification** — classifies fields into nutrient_loss_risk, nutrient_retentive, or nutrient_responsive zones based on CEC, sand/clay, SOC, pH, and leaching risk.
- `GET /fields/{id}/soil/nutrient-context` endpoint — returns zone classification with confidence score and agronomic interpretation.
- **Carbon sequestration estimation** — Hassink (1997) clay-dependent protective capacity model with climate zone adjustment; estimates current SOC stock, saturation deficit, and sequestration potential range.
- `GET /fields/{id}/soil/carbon-estimate` endpoint — returns current SOC stock, estimated saturation, and conservative sequestration potential (30–70% of deficit).
- **Soil × weather stress indicators** — combines rootzone AWC with 30-day water balance, drought index, and soil moisture to detect drought/wet/optimal conditions.
- `GET /fields/{id}/soil/weather-stress` endpoint — returns stress status with severity score (0–1) and contributing factors.
- **Rosetta PTF integration** — pedotransfer functions estimate field capacity, wilting point, and saturated hydraulic conductivity from texture + bulk density on soil layers.
- Derived agronomic columns on soil layers — `field_capacity`, `wilting_point`, `saturated_conductivity`, `awc_derived`.
- SOC stock depth-integrated calculation (t/ha) in field summary.
- Refined risk scoring — waterlogging risk from poor drainage + low Ksat; updated compaction and leaching formulas.
- **Soil-aware alerts** — automatic alert generation on soil fetch for: pH < 5.5 (acidic), pH < 4.5 (very acidic), SOC < 10 g/kg (low), SOC < 5 g/kg (very low), compaction risk > 0.6, waterlogging risk > 0.6, sand > 80% (leaching), CEC < 5 cmol/kg (low retention).
- `soil_context` JSONB column on alerts table — stores soil property values at alert creation time (same pattern as `weather_context`).
- Soil alerts displayed in alert list with soil-specific icons, property values, and thresholds.
- **Soil summary in share reports** — texture class, pH, SOC, CEC, drainage included in public share page report alongside weather summary.
- `soil_summary` in `ShareReportOut` API schema.
- Soil summary section on public share page with cards for texture, pH, organic carbon, CEC, AWC, drainage.
- **Sampling zone map markers** — bullseye-style markers on MapLibre (outer ring + inner disc + center dot) with priority color coding (P1=red, P2=yellow, P3=blue).
- **Scouting observation map markers** — amber circle markers with white stroke and observation detail popups.
- **Interactive map popups** — CSS-based popup styling using shadcn design tokens (`--popover`, `--popover-foreground`, `--muted-foreground`) for dark mode compatibility.
- Click-to-zoom on sampling zone sidebar cards — `flyTo` with zoom level 17.
- Tab-based marker visibility toggling — scouting markers only visible on scouting tab, sampling markers only visible on soil tab.
- Soil tab intelligence panels — crop suitability card with ranked list, nutrient context badges, carbon estimation gauge with sequestration range, weather stress traffic-light indicator, sampling zones sidebar.
- Crop suitability weather-required info banner when weather data is insufficient.
- Alembic migration `0012_add_derived_agronomic_columns` — field capacity, wilting point, saturated conductivity, AWC derived columns on soil layers.
- Alembic migration `0013_add_soil_context_to_alerts` — `soil_context` JSONB column on alerts table.
- English and Spanish translations for all intelligence UI strings (~100 i18n keys).

### Fixed
- **Crop suitability sign convention** — drought severity now correctly uses `di < 0` for drought (was `di > 0`) in soil router; flood detection uses `drought_idx > 1.0` (was `< -1.0`) in intelligence engine.
- Field's own crop suitability returned even when outside top 10 — endpoint now searches full list before truncating.
- Race condition in field creation task dispatch — weather refresh and backfill tasks now dispatched after commit.
- Rosetta-soil API compatibility — updated to work with rosetta-soil v0.3.x response format.
- Popup title no longer overlaps close button — added `padding-right: 18px` to popup title CSS.

---

## [0.7.0] - 2026-03-19

### Added
- **Soil intelligence foundation** — automatic soil profile ingestion from SoilGrids (global, 250m) and POLARIS (US, 30m) on field creation.
- `soil_profiles`, `soil_layers`, and `soil_field_summary` database tables with UUID PKs, PostGIS integration, and full audit trail.
- SoilGrids WCS client — fetches 10 baseline properties (sand, silt, clay, pH, SOC, bulk density, CEC, nitrogen, coarse fragments, organic carbon density) across 6 GlobalSoilMap depths (0–200cm) with mean/Q05/Q95 quantiles.
- POLARIS S3 client — reads COG tiles for 9 properties across 6 depths for US fields (30m resolution).
- Automatic source routing — POLARIS for CONUS coordinates, SoilGrids globally.
- USDA soil texture triangle classification (12 classes) from sand/silt/clay percentages.
- Unit conversion pipeline for SoilGrids storage units to conventional units (pH×10→pH, cg/cm³→kg/dm³, etc.).
- Available Water Capacity (AWC) computation per layer and depth-integrated rootzone AWC.
- Field summary aggregation with dominant texture, average pH, SOC stock, rootzone AWC, and drainage class.
- Risk scoring (0–1 scale) for acidification, compaction, leaching, and rooting constraint.
- Data quality score based on uncertainty spread (Q95−Q05)/mean across properties.
- Celery task `fetch_soil_for_field` with retry logic, exponential backoff, and graceful partial-data handling.
- Auto-trigger on field creation — new fields automatically get soil profile data.
- API endpoints: `GET /fields/{id}/soil` (profile + layers), `GET /fields/{id}/soil/summary`, `POST /fields/{id}/soil/refresh` (rate-limited 1/min).
- Soil tab on field detail page with texture-by-depth stacked bar chart (sand/silt/clay), color-coded legend, and interactive tooltips with color-matched dots and uncertainty ranges.
- Property cards for pH (color-coded scale), Organic Carbon (g/kg with level badge), CEC (nutrient buffering), and Bulk Density (compaction indicator).
- AWC gauge with Low/Moderate/Good classification and progress bar.
- Risk indicator badges with green/yellow/red dot system for all four risk dimensions.
- Data quality and source metadata display with resolution and fetch date.
- "Regional Estimate" disclaimer banner — soil data clearly labeled as satellite-derived estimates, not field measurements.
- Job progress tracking for soil refresh — 6-step checklist UI with real-time polling (source detection → data fetch → layer processing → summary → save → complete).
- Retry logic on soil data reload (3 attempts with 2s delay) for resilient UX after long-running fetches.
- Tooltip portal fix — all tooltips now render via Radix Portal to prevent clipping inside overflow containers.
- Alembic migration `0011_add_soil_tables` for all three soil tables with FK indexes.
- English and Spanish translations for all soil UI strings (~65 keys).
- Configuration settings: SoilGrids WCS base URL (HTTPS), POLARIS S3 bucket, fetch timeout, source priority.

### Fixed
- Tooltip clipping in sidebar panels — `TooltipContent` now wrapped in `TooltipPrimitive.Portal` (affects all tooltips app-wide).
- Pydantic v2 UUID serialization — soil schemas use `uuid.UUID` type instead of `str` to match ORM model output.
- SoilGrids WCS redirect handling — `httpx` calls use `follow_redirects=True` and `map` parameter passed in params dict instead of URL string.
- Tab header layout for Spanish locale — switched from rigid grid to flex layout with `justify-evenly` for i18n-safe tab sizing.
- Sidebar width increased to 440px to accommodate Spanish translations without text clipping.

---

## [0.6.0] - 2026-03-19

### Added
- **Historical data backfill** — automatic 24-month vegetation index backfill for all four indices (NDVI, EVI, SAVI, NDWI) on field creation.
- Backfill orchestrator task (`backfill_indices_for_field`) that splits date ranges into 90-day chunks and dispatches one job per (chunk × index) pair with staggered countdowns.
- Chunk-level and index-level deduplication — skips chunks/indices where raster data already exists.
- Weekly auto-compute Celery Beat schedule (`schedule_weekly_index_compute`) — runs every Monday at 06:00 UTC, skips fields with recent data (< 5 days old).
- Manual backfill API endpoint: `POST /fields/{id}/backfill-indices` with configurable month range (admin/owner only, rate-limited 1/minute).
- Backfill status API endpoint: `GET /fields/{id}/backfill-status` — returns pending, running, and completed job counts.
- Endpoint-level deduplication — returns 409 Conflict if a backfill is already in progress for the field.
- Sentinel job pattern — synchronous placeholder job created before async Celery dispatch to prevent race conditions with status checks.
- Alert suppression for backfill jobs — backfill pipeline runs do not create alerts (controlled via `is_backfill` flag in `params_json`).
- Backfill History button on field Indices tab with loading state, active-backfill detection, and progress banner.
- Batch backfill task (`backfill_all_existing_fields`) for retroactive backfill of all org fields.
- Configuration settings: `index_backfill_months` (default 24), `index_backfill_chunk_days` (default 90).
- English and Spanish translations for all backfill UI strings.

---

## [0.5.0] - 2026-03-17

### Added
- **Weather data integration** with daily historical + 7-day forecast weather per field via Open-Meteo API (free, CC BY 4.0).
- `weather_daily` database table with 18 raw variables (temperature, precipitation, ET₀, soil moisture at 5 depths, soil temperature at 4 depths, VPD, solar radiation, wind speed, cloud cover) and 5 pre-computed agricultural indices (GDD, cumulative GDD, 30-day water balance, drought index, heat stress flag).
- Celery tasks for automated weather fetching: daily scheduled fetch at 08:00 UTC (batched by 50), on-demand 90-day historical backfill.
- Weather API endpoints: `GET /fields/{id}/weather` (date range + forecast), `GET /fields/{id}/weather/summary` (30-day stats), `POST /fields/{id}/weather/backfill` (manual trigger).
- Weather tab on field detail page with unified stats grid (temperature, precipitation, water deficit, GDD, VPD, soil moisture, frost days, heat stress days).
- 7-day forecast horizontal bar with weather icons, temperature ranges, and precipitation.
- Temperature & precipitation dual-axis time-series chart (ECharts).
- ET₀ & water balance dual-axis chart with deficit threshold line.
- Soil moisture depth gauge — 5-layer horizontal bars (0–81 cm) with color-coded thresholds.
- Soil temperature depth display — 4-layer bars (surface, 6 cm, 18 cm, 54 cm) with temperature color coding.
- Vapor pressure deficit (VPD) card with zone classification (low/ideal/moderate/high) and agronomic guidance.
- NDVI + weather overlay chart — toggle button in Indices tab to overlay precipitation bars and ET₀ line on vegetation index time series.
- Alert enrichment — `weather_context` JSONB column on alerts table with 7-day precipitation, ET₀, water deficit, soil moisture, GDD, and drought index at time of alert creation.
- Scouting weather snapshot — auto-attached 7-day weather context (temps, precipitation, wind, soil moisture, drought index) on observation creation.
- Share report weather section — 30-day weather summary and 90-day daily weather data included in public share reports.
- Weather context displayed on alert cards in both sidebar and share page.
- Time range selector (30 days / 90 days / Season) for weather tab.
- Alembic migrations: `weather_daily` table (0008), `weather_context` on alerts (0009), `weather_snapshot` on scouting observations (0010).
- Configuration settings: Open-Meteo API URLs, backfill days, batch size, GDD base temperature, heat stress threshold.
- English and Spanish translations for all weather UI strings.

### Changed
- "Monitor" tab renamed to "Indices" on field detail page.
- Weather stats cards consolidated into a single unified grid with farmer-centric layout and variable column widths.
- Chart and gauge sections wrapped in card containers for visual consistency.

---

## [0.4.0] - 2026-03-17

### Added
- **Automatic field boundary detection** from Sentinel-2 satellite imagery using the FTW (Fields of The World) deep learning model.
- Dedicated ML processor Docker service (`ml-processor`) with PyTorch, torchgeo, and FTW model weights.
- Detection API endpoints: trigger detection, list/accept/discard detected boundaries.
- Full-page detection UI (`/farms/[id]/detect`) with 3-phase workflow: draw area → detecting → review results.
- Interactive polygon drawing via MapLibre GL Draw (pan, zoom, draw, move, edit vertices, delete).
- Viewport preservation across detection phase transitions (draw → detecting → review).
- Bbox overlay shown during detection processing phase.
- Boundary review sidebar with confidence scores, area display, and accept/discard/edit actions.
- Bulk accept-all and discard-all for detected boundaries.
- Zoom-to-boundary on selection from sidebar or map click.
- Boundary geometry editing with DrawMap before accepting as a field.
- 7-step job progress tracking for detection pipeline (validate → STAC search → download → prepare → inference → polygonize → store).
- Alembic migrations for detected boundaries table, nullable job field_id, and updated_at column.
- English and Spanish translations for all detection UI strings.
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
