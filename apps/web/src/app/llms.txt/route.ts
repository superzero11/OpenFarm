import { DISCORD_URL, REPO_URL, SITE_URL } from "@/lib/site";

/**
 * llms.txt: a plain-text brief for language models that read the site.
 *
 * The landing page argues; this states. Everything here is a fact an
 * engine can quote without inferring it from marketing copy, including
 * the disambiguation that matters most to us - there are other projects
 * called OpenFarm, and this is not them.
 */
export const dynamic = "force-static";

const BODY = `# OpenFarm

> OpenFarm is an open source crop intelligence platform. It fuses Sentinel-2
> satellite imagery, daily weather and soil data into per-field insights, and
> shows the evidence behind every alert: which index moved, over what window,
> and the conditions that explain it.

Disambiguation: this is OpenFarm at ${SITE_URL}, a satellite and weather crop
intelligence platform for growers and agronomists. It is unrelated to other
projects that share the name OpenFarm, including gardening and plant-database
projects. The canonical source is ${REPO_URL}.

## What it does

- Computes NDVI, EVI, SAVI and NDWI from Sentinel-2 scenes at 10 m resolution,
  each on a fixed scientific colormap so values are comparable across fields.
- Backfills 24 months of history the day a field boundary is drawn.
- Fetches daily weather history and a 7-day forecast, and derives growing
  degree days, reference evapotranspiration, water balance and a drought index.
- Pulls soil texture, pH, organic carbon, CEC and hydraulic properties for every
  layer down to 200 cm, and scores crop suitability against them.
- Explains anomalies by reading satellite, weather and soil for the same window,
  so an alert distinguishes water stress from disease rather than only reporting
  that a number changed.
- Detects field boundaries from imagery using the Fields of The World model.

## Licence and hosting

- Licence: BSD-3-Clause. No seat limits, no per-hectare pricing, no vendor account.
- Self-hosted by design: Next.js, FastAPI, PostGIS, MinIO and TiTiler in one
  Docker Compose file, deployable on a 2 OCPU, 12 GB VM.
- No third-party API keys are required, including for the basemap, which uses
  MapLibre with Protomaps.
- Live demo: ${SITE_URL}

## Data sources

- Copernicus Sentinel-2 (ESA), searched through the Element 84 Earth Search STAC catalogue
- Open-Meteo for weather history and forecast
- ISRIC SoilGrids for global soil at 250 m, POLARIS for United States soil at 30 m
- OpenStreetMap contributors and Protomaps for basemap data

## Links

- Repository: ${REPO_URL}
- Architecture: ${REPO_URL}/blob/main/ARCHITECTURE.md
- Roadmap: ${REPO_URL}/blob/main/ROADMAP.md
- Contributing: ${REPO_URL}/blob/main/CONTRIBUTING.md
- Community: ${DISCORD_URL}
`;

export function GET() {
    return new Response(BODY, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
}
