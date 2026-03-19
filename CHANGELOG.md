# Changelog

All notable changes to OpenFarm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

---

## [0.8.0] - 2026-03-19

### Added
- Crop suitability scoring for 68 crops using a 4-pillar model: Soil Fit (40%), Water Match (25%), Climate Fit (20%), Stress Resilience (15%).
- Crop profiles spanning cereals, legumes, oilseeds, industrial crops, root vegetables, fruits, plantations, and spices.
- Weather-aware crop recommendations that factor in rainfall, temperature, and drought or flood conditions.
- Your field's current crop is always shown in the results, even if it falls outside the top 10.
- Intelligent soil sampling zone recommendations based on within-field variability in clay, organic carbon, pH, and water capacity.
- Sampling zones displayed as color-coded map markers with priority levels (high, medium, low).
- Click any sampling zone card to fly to its location on the map.
- Nutrient risk classification for each field: nutrient loss risk, nutrient retentive, or nutrient responsive.
- Carbon sequestration estimation showing current organic carbon stock, saturation potential, and achievable sequestration range.
- Soil and weather stress monitor combining soil water capacity with recent rainfall to detect drought stress, waterlogging, or optimal conditions.
- Automatic soil-based alerts for acidic pH, low organic carbon, compaction risk, waterlogging risk, high sand content, and low nutrient retention.
- Soil context included with alerts so you can see the exact soil values that triggered them.
- Soil summary section added to shared field reports (texture, pH, organic carbon, CEC, drainage).
- Scouting observation markers on the map with popups showing observation details.
- Map popups styled for both light and dark themes.
- Markers are only visible on their respective tab (scouting markers on Scouting, sampling markers on Soil).
- Improved soil water capacity estimates using pedotransfer functions derived from texture and bulk density.
- Refined risk scoring for waterlogging, compaction, and leaching based on hydraulic properties.
- Depth-integrated organic carbon stock calculation in the field soil summary.
- English and Spanish translations for all new features.

### Fixed
- Crop suitability now correctly identifies drought and flood conditions (previously inverted).
- Your field's crop is returned in suitability results even when outside the top 10 recommendations.
- Field creation no longer has a race condition when triggering weather and vegetation backfill.
- Map popup titles no longer overlap with the close button.

---

## [0.7.0] - 2026-03-19

### Added
- Automatic soil profile analysis for every field using SoilGrids (worldwide, 250m resolution) and POLARIS (US fields, 30m resolution).
- Soil data fetched automatically when a new field is created.
- Soil tab on field detail page with depth-by-depth breakdown of sand, silt, and clay percentages.
- Interactive soil texture chart with color-coded legend and tooltips showing uncertainty ranges.
- Property cards for pH, Organic Carbon, CEC (nutrient buffering), and Bulk Density (compaction indicator).
- Available Water Capacity gauge with Low, Moderate, and Good classification.
- Risk indicators for acidification, compaction, leaching, and rooting constraints (green/yellow/red dots).
- Data quality and source metadata display showing resolution and fetch date.
- Regional Estimate disclaimer banner clarifying that soil data is satellite-derived, not from field measurements.
- Refresh button to re-fetch soil data with real-time 6-step progress tracking.
- Tooltip portal fix preventing tooltips from being clipped inside sidebar panels.
- English and Spanish translations for all soil-related features.

### Fixed
- Tooltips no longer get clipped inside sidebar panels.
- Soil tab header layout adapts properly for Spanish translations.
- Sidebar width increased to accommodate longer Spanish text without clipping.

---

## [0.6.0] - 2026-03-19

### Added
- Automatic 24-month historical backfill of all four vegetation indices (NDVI, EVI, SAVI, NDWI) when a new field is created.
- Historical data split into manageable chunks and processed in parallel for faster completion.
- Smart deduplication skips time periods and indices that already have data.
- Weekly automatic vegetation index updates every Monday at 06:00 UTC, skipping fields with recent data.
- Manual backfill button on the Indices tab with progress banner showing active backfill status.
- Backfill does not generate alerts for historical data to avoid notification noise.
- Duplicate backfill requests are blocked to prevent unnecessary processing.
- English and Spanish translations for all backfill-related features.

---

## [0.5.0] - 2026-03-17

### Added
- Daily weather data for every field via Open-Meteo (free, open data).
- 18 weather variables including temperature, precipitation, evapotranspiration, soil moisture at 5 depths, soil temperature, wind speed, solar radiation, and cloud cover.
- 5 agricultural indices computed automatically: Growing Degree Days (GDD), cumulative GDD, 30-day water balance, drought index, and heat stress flag.
- Weather tab on field detail page with summary stats, 7-day forecast bar, temperature and precipitation charts, and evapotranspiration chart.
- Soil moisture depth gauge showing moisture levels from surface to 81 cm.
- Soil temperature display at 4 depths (surface, 6 cm, 18 cm, 54 cm).
- Vapor Pressure Deficit (VPD) card with zone classification and agronomic guidance.
- Weather overlay on vegetation index charts showing precipitation bars and evapotranspiration line.
- Weather context automatically attached to alerts showing conditions at the time of the alert.
- Weather snapshot automatically attached to scouting observations.
- Weather summary and 90-day daily data included in shared field reports.
- Time range selector (30 days, 90 days, Season) for the weather tab.
- Automatic daily weather fetch at 08:00 UTC for all fields.
- English and Spanish translations for all weather features.

### Changed
- Monitor tab renamed to Indices on the field detail page.
- Weather stats cards consolidated into a single unified grid layout.

---

## [0.4.0] - 2026-03-17

### Added
- Automatic field boundary detection from Sentinel-2 satellite imagery using the Fields of The World (FTW) deep learning model.
- Three-phase detection workflow: draw an area on the map, wait for detection, then review the results.
- Interactive polygon drawing with pan, zoom, move, edit vertices, and delete tools.
- Boundary review sidebar with confidence scores, area display, and accept or discard actions.
- Bulk accept-all and discard-all buttons for detected boundaries.
- Click any boundary in the sidebar or on the map to zoom to it.
- Edit boundary geometry before accepting it as a field.
- 7-step progress tracking during detection (validate, search imagery, download, prepare, detect, process, store).
- Changelog page added to the sidebar navigation.
- SAVI L factor displayed on vegetation index layer cards.
- English and Spanish translations for all detection features.

### Fixed
- Vegetation index tab order now matches sidebar order (NDVI, EVI, SAVI, NDWI).
- Start Processing button no longer stays disabled after a completed analysis.
- SAVI L factor is now saved and displayed correctly on processed layers.

---

## [0.3.0] - 2026-03-16

### Added
- Three new vegetation indices alongside NDVI: EVI, SAVI (with configurable L factor), and NDWI for water stress detection.
- Each index has its own colormap, alert thresholds, and severity rules.
- Index type selector on field detail page, share page, and alert filters.
- English and Spanish translations for all index-related features.

### Changed
- Share page reports grouped by vegetation index type with a toggle selector.
- Tile rendering uses per-index colormaps instead of hardcoded NDVI colors.

### Fixed
- Services no longer run as root for improved security.
- Upload endpoint only accepts JPEG, PNG, and WebP image formats.
- Farm deletion is now atomic, preventing partial deletes.
- Invalid polygon geometries are rejected with clear error messages.
- Organization context errors now show a user-facing notification instead of failing silently.

### Security
- Rate limits added to organization invite and member management actions.
- Database query performance improved with additional indexes.

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
