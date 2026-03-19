# OpenFarm Strategic Architecture

> **OpenFarm is an open, modular field intelligence platform that fuses satellite, weather, soil, and time to explain what is happening in a field — and why.**

OpenFarm follows a 3-layer strategic architecture. Each layer has a distinct role: the Observation layer creates **data gravity**, the Intelligence layer is the **moat**, and the Delivery layer drives **distribution**.

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

---

## Layer A — Observation Infrastructure

*"What do we observe about the field?"*

Collects, standardizes, and stores raw signals about every field. Source-agnostic, reproducible, and extensible.

### Satellite Intelligence
- Sentinel-2 (initial), extensible to Landsat, Planet, SAR (Sentinel-1)
- Raster ingestion pipelines (COG/STAC compliant)
- Index computation: NDVI, EVI, SAVI, NDWI
- Temporal stacking & versioning
- Cloud masking & gap handling (future: fusion)

### Weather Intelligence
- Open-Meteo integration (global baseline)
- Historical + forecast weather
- Derived metrics: GDD (Growing Degree Days), ET₀, rainfall accumulation
- Spatial interpolation at field level

### Soil Intelligence
- Global + regional datasets: SoilGrids (global), POLARIS (US), ESDAC (EU)
- Depth-aware soil profiles (0–5, 5–15, 15–30, 30–60, 60–100, 100–200 cm)
- Core properties: texture (sand/silt/clay), SOC, pH, CEC, bulk density, nitrogen proxies
- Uncertainty retained as first-class signal

### Field & Spatial Context
- Field boundary detection (FTW deep learning model)
- Manual & imported boundaries (GeoJSON/KML)
- Terrain layers: elevation, slope, aspect
- Spatial indexing (PostGIS)

### Extensible Inputs (Future)
- IoT sensors (soil moisture, EC, pH)
- Farm operations data
- External APIs (market, irrigation)

### Output of Observation Layer

A standardized, queryable field data model:

```
Field = {
  geometry,
  time_series: { satellite, weather },
  soil_profile: { ... },
  terrain: { ... },
  metadata
}
```

---

## Layer B — Intelligence Engine

*"What does it mean?"*

The heart of OpenFarm — where raw signals are converted into explainable, agronomically meaningful insights. This is the strategic differentiator.

### Field Understanding Engine
- Temporal analytics (trend, deviation, anomaly)
- Field segmentation (zones based on variability)
- Change detection (intra-season + inter-season)

### Crop Intelligence
- Crop type detection (future ML models)
- Phenology tracking (stage detection from NDVI/EVI temporal curves)
- Growth progression modeling

### Stress & Risk Intelligence
- Water stress signals (satellite + soil + weather)
- Disease/pest risk models: weather + crop stage + anomaly signals
- Nutrient deficiency indicators (proxy-based initially)

### Soil-Derived Intelligence
- Water holding capacity (derived via Rosetta PTF)
- Drainage / runoff / leaching risk
- Nutrient buffering capacity
- Salinity / compaction susceptibility proxies
- Soil × weather × crop interaction modeling

### Predictive Intelligence (Progressive Build)
- Yield estimation (multi-season learning)
- Irrigation advisory
- Fertilizer response zones (not prescriptions initially)
- Carbon baseline & sequestration opportunity

### Explainability & Trust Layer

Every insight carries:
- **Confidence scores** per insight
- **Input signal breakdown**: "This alert is based on NDVI drop + rainfall deficit + sandy soil"
- **Historical comparison**: "This field behaved similarly in 2022"

### Output of Intelligence Layer

```
Insight = {
  type: "stress" | "growth" | "risk" | "zone",
  confidence,
  drivers: [satellite, weather, soil],
  spatial_extent,
  temporal_context,
  explanation
}
```

---

## Layer C — Delivery Surfaces

*"How is it consumed?"*

Ensures OpenFarm is not just a tool — but a platform others can build on.

### Visual Interface (UI)
- Interactive field maps (MapLibre + PMTiles)
- Time-series charts (NDVI, rainfall, etc.) via ECharts
- Layer toggles (satellite, soil, weather)
- Zone visualization

### Reports & Outputs
- Field intelligence reports (shareable links)
- Seasonal summaries
- Export: GeoJSON, CSV, raster tiles, PDF

### API-first Platform
- REST API (`/v1`) with JWT + RBAC
- Webhooks for alerts
- Versioned public API with API keys (future)

### Agent / LLM Interface (Future)
- Natural language field queries
- Model Context Protocol (MCP) server for AI agents
- AI plugin ecosystem

### Lightweight Field Tools
- Scouting: geotagged observations with photo upload
- Ground truth collection

### Deployment Philosophy
- Self-hostable (core identity)
- Optional managed cloud (future)
- Multi-tenant + enterprise-ready architecture

---

## What OpenFarm IS

> An open, modular field intelligence platform that fuses satellite, weather, soil, and time to explain what is happening in a field — and why.

## What OpenFarm is NOT

- ❌ Farm ERP
- ❌ Task/operations manager
- ❌ Generic ag marketplace
