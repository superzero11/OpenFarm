"""Soil intelligence - derived analytics computed from soil + weather data.

Contains computation functions for:
- Sampling zone recommendations (within-field variability)
- Crop suitability assessment
- Nutrient-risk zone classification
- Carbon sequestration potential estimation
- Weather × soil stress indicators
- Soil-based alert evaluation
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


# ── Crop Requirement Profiles ────────────────────────────────────────


@dataclass(frozen=True)
class CropRequirements:
    """Optimal soil conditions for a crop."""

    name: str
    ph_min: float
    ph_max: float
    min_awc_mm: float  # rootzone AWC minimum
    preferred_textures: list[str]
    drainage_tolerance: list[str]  # acceptable drainage classes
    min_soc_g_kg: float  # minimum topsoil SOC
    max_clay_pct: float = 100.0
    min_clay_pct: float = 0.0
    # ── Weather-aware fields (v2) ──
    min_cec_cmol_kg: float = 5.0  # minimum CEC for nutrient supply
    min_annual_rainfall_mm: float = 400.0
    max_annual_rainfall_mm: float = 2500.0
    min_temp_c: float = 10.0  # minimum mean growing-season temperature
    max_temp_c: float = 35.0  # maximum mean growing-season temperature
    drought_tolerance: float = 0.3  # 0 = no tolerance, 1 = full
    flood_tolerance: float = 0.2  # 0 = no tolerance, 1 = full


CROP_PROFILES: dict[str, CropRequirements] = {
    # ── Cereals & Staple Grains ──────────────────────────────────────
    "wheat": CropRequirements(
        name="Wheat",
        ph_min=6.0,
        ph_max=7.5,
        min_awc_mm=100,
        preferred_textures=["loam", "silt loam", "clay loam", "silty clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=450,
        max_annual_rainfall_mm=1800,
        min_temp_c=5.0,
        max_temp_c=30.0,
        drought_tolerance=0.4,
        flood_tolerance=0.2,
    ),
    "corn": CropRequirements(
        name="Corn / Maize",
        ph_min=5.8,
        ph_max=7.0,
        min_awc_mm=120,
        preferred_textures=["loam", "silt loam", "silty clay loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=10.0,
        max_temp_c=35.0,
        drought_tolerance=0.3,
        flood_tolerance=0.15,
    ),
    "rice": CropRequirements(
        name="Rice",
        ph_min=5.0,
        ph_max=6.5,
        min_awc_mm=60,
        preferred_textures=["clay", "silty clay", "clay loam", "silty clay loam"],
        drainage_tolerance=[
            "poorly drained",
            "very poorly drained",
            "somewhat poorly drained",
            "moderately well drained",
        ],
        min_soc_g_kg=8.0,
        min_clay_pct=20.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=1200,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.1,
        flood_tolerance=0.9,
    ),
    "barley": CropRequirements(
        name="Barley",
        ph_min=6.0,
        ph_max=8.0,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=6.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=350,
        max_annual_rainfall_mm=1500,
        min_temp_c=5.0,
        max_temp_c=28.0,
        drought_tolerance=0.5,
        flood_tolerance=0.15,
    ),
    "sorghum": CropRequirements(
        name="Sorghum",
        ph_min=5.5,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["loam", "clay loam", "sandy loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "moderately well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=20.0,
        max_temp_c=40.0,
        drought_tolerance=0.8,
        flood_tolerance=0.15,
    ),
    "millet": CropRequirements(
        name="Millet",
        ph_min=5.5,
        ph_max=7.5,
        min_awc_mm=40,
        preferred_textures=["sandy loam", "loam", "loamy sand"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=3.0,
        min_cec_cmol_kg=3.0,
        min_annual_rainfall_mm=300,
        max_annual_rainfall_mm=800,
        min_temp_c=25.0,
        max_temp_c=40.0,
        drought_tolerance=0.9,
        flood_tolerance=0.1,
    ),
    "oats": CropRequirements(
        name="Oats",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=6.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1500,
        min_temp_c=5.0,
        max_temp_c=25.0,
        drought_tolerance=0.4,
        flood_tolerance=0.2,
    ),
    "rye": CropRequirements(
        name="Rye",
        ph_min=5.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "moderately well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=6.0,
        min_annual_rainfall_mm=350,
        max_annual_rainfall_mm=1200,
        min_temp_c=2.0,
        max_temp_c=25.0,
        drought_tolerance=0.5,
        flood_tolerance=0.15,
    ),
    "quinoa": CropRequirements(
        name="Quinoa",
        ph_min=6.0,
        ph_max=8.5,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=["well drained", "somewhat excessively drained"],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=300,
        max_annual_rainfall_mm=1000,
        min_temp_c=8.0,
        max_temp_c=28.0,
        drought_tolerance=0.6,
        flood_tolerance=0.1,
    ),
    # ── Legumes & Oilseeds ───────────────────────────────────────────
    "soybean": CropRequirements(
        name="Soybean",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=100,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=15.0,
        max_temp_c=32.0,
        drought_tolerance=0.3,
        flood_tolerance=0.2,
    ),
    "groundnut": CropRequirements(
        name="Groundnut / Peanut",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "loamy sand"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        max_clay_pct=30.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1200,
        min_temp_c=20.0,
        max_temp_c=38.0,
        drought_tolerance=0.5,
        flood_tolerance=0.1,
    ),
    "chickpea": CropRequirements(
        name="Chickpea",
        ph_min=6.0,
        ph_max=8.0,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "clay loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=6.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1000,
        min_temp_c=10.0,
        max_temp_c=32.0,
        drought_tolerance=0.6,
        flood_tolerance=0.1,
    ),
    "lentil": CropRequirements(
        name="Lentil",
        ph_min=6.0,
        ph_max=8.0,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=6.0,
        min_annual_rainfall_mm=300,
        max_annual_rainfall_mm=1000,
        min_temp_c=8.0,
        max_temp_c=28.0,
        drought_tolerance=0.5,
        flood_tolerance=0.1,
    ),
    "sunflower": CropRequirements(
        name="Sunflower",
        ph_min=6.0,
        ph_max=7.5,
        min_awc_mm=80,
        preferred_textures=["loam", "clay loam", "silt loam", "sandy loam"],
        drainage_tolerance=[
            "well drained",
            "moderately well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=6.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=12.0,
        max_temp_c=35.0,
        drought_tolerance=0.6,
        flood_tolerance=0.1,
    ),
    "rapeseed": CropRequirements(
        name="Rapeseed / Canola",
        ph_min=5.5,
        ph_max=7.5,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=6.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1500,
        min_temp_c=5.0,
        max_temp_c=28.0,
        drought_tolerance=0.35,
        flood_tolerance=0.15,
    ),
    "sesame": CropRequirements(
        name="Sesame",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=50,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=4.0,
        min_cec_cmol_kg=4.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1000,
        min_temp_c=20.0,
        max_temp_c=40.0,
        drought_tolerance=0.7,
        flood_tolerance=0.05,
    ),
    # ── Industrial & Fibre Crops ─────────────────────────────────────
    "cotton": CropRequirements(
        name="Cotton",
        ph_min=5.8,
        ph_max=7.5,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam", "sandy clay loam"],
        drainage_tolerance=[
            "well drained",
            "moderately well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=20.0,
        max_temp_c=38.0,
        drought_tolerance=0.5,
        flood_tolerance=0.1,
    ),
    "sugarcane": CropRequirements(
        name="Sugarcane",
        ph_min=5.5,
        ph_max=7.5,
        min_awc_mm=120,
        preferred_textures=["loam", "clay loam", "silt loam", "silty clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=1200,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=38.0,
        drought_tolerance=0.2,
        flood_tolerance=0.4,
    ),
    "sugar_beet": CropRequirements(
        name="Sugar Beet",
        ph_min=6.5,
        ph_max=8.0,
        min_awc_mm=100,
        preferred_textures=["loam", "silt loam", "silty clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1200,
        min_temp_c=5.0,
        max_temp_c=25.0,
        drought_tolerance=0.3,
        flood_tolerance=0.15,
    ),
    "tobacco": CropRequirements(
        name="Tobacco",
        ph_min=5.5,
        ph_max=6.5,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=1500,
        min_temp_c=15.0,
        max_temp_c=35.0,
        drought_tolerance=0.3,
        flood_tolerance=0.1,
    ),
    "jute": CropRequirements(
        name="Jute",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam", "silty clay loam"],
        drainage_tolerance=[
            "moderately well drained",
            "somewhat poorly drained",
        ],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=1200,
        max_annual_rainfall_mm=2500,
        min_temp_c=24.0,
        max_temp_c=38.0,
        drought_tolerance=0.15,
        flood_tolerance=0.6,
    ),
    # ── Forage & Cover Crops ─────────────────────────────────────────
    "alfalfa": CropRequirements(
        name="Alfalfa / Lucerne",
        ph_min=6.5,
        ph_max=7.5,
        min_awc_mm=100,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1500,
        min_temp_c=5.0,
        max_temp_c=32.0,
        drought_tolerance=0.6,
        flood_tolerance=0.15,
    ),
    "clover": CropRequirements(
        name="Clover",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=[
            "well drained",
            "moderately well drained",
            "somewhat poorly drained",
        ],
        min_soc_g_kg=6.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=5.0,
        max_temp_c=28.0,
        drought_tolerance=0.3,
        flood_tolerance=0.4,
    ),
    # ── Root & Tuber Crops ───────────────────────────────────────────
    "potato": CropRequirements(
        name="Potato",
        ph_min=5.0,
        ph_max=6.5,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=8.0,
        max_clay_pct=35.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=8.0,
        max_temp_c=25.0,
        drought_tolerance=0.25,
        flood_tolerance=0.1,
    ),
    "cassava": CropRequirements(
        name="Cassava",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "sandy clay loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=5.0,
        max_clay_pct=40.0,
        min_cec_cmol_kg=4.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=2000,
        min_temp_c=22.0,
        max_temp_c=38.0,
        drought_tolerance=0.7,
        flood_tolerance=0.1,
    ),
    "sweet_potato": CropRequirements(
        name="Sweet Potato",
        ph_min=5.5,
        ph_max=6.5,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=5.0,
        max_clay_pct=35.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=750,
        max_annual_rainfall_mm=1800,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.5,
        flood_tolerance=0.15,
    ),
    "yam": CropRequirements(
        name="Yam",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        max_clay_pct=40.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=1000,
        max_annual_rainfall_mm=2500,
        min_temp_c=22.0,
        max_temp_c=35.0,
        drought_tolerance=0.3,
        flood_tolerance=0.2,
    ),
    "carrot": CropRequirements(
        name="Carrot",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=8.0,
        max_clay_pct=30.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1200,
        min_temp_c=8.0,
        max_temp_c=28.0,
        drought_tolerance=0.25,
        flood_tolerance=0.1,
    ),
    "onion": CropRequirements(
        name="Onion",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1200,
        min_temp_c=10.0,
        max_temp_c=30.0,
        drought_tolerance=0.3,
        flood_tolerance=0.1,
    ),
    "garlic": CropRequirements(
        name="Garlic",
        ph_min=6.0,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1000,
        min_temp_c=8.0,
        max_temp_c=28.0,
        drought_tolerance=0.35,
        flood_tolerance=0.1,
    ),
    # ── Vegetables ───────────────────────────────────────────────────
    "tomato": CropRequirements(
        name="Tomato",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=15.0,
        max_temp_c=35.0,
        drought_tolerance=0.25,
        flood_tolerance=0.1,
    ),
    "pepper": CropRequirements(
        name="Pepper / Capsicum",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=1500,
        min_temp_c=18.0,
        max_temp_c=35.0,
        drought_tolerance=0.2,
        flood_tolerance=0.1,
    ),
    "eggplant": CropRequirements(
        name="Eggplant / Brinjal",
        ph_min=5.5,
        ph_max=6.8,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=18.0,
        max_temp_c=35.0,
        drought_tolerance=0.25,
        flood_tolerance=0.1,
    ),
    "cucumber": CropRequirements(
        name="Cucumber",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=1500,
        min_temp_c=18.0,
        max_temp_c=35.0,
        drought_tolerance=0.2,
        flood_tolerance=0.1,
    ),
    "okra": CropRequirements(
        name="Okra",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["loam", "sandy loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=1800,
        min_temp_c=22.0,
        max_temp_c=38.0,
        drought_tolerance=0.35,
        flood_tolerance=0.15,
    ),
    "cabbage": CropRequirements(
        name="Cabbage",
        ph_min=6.0,
        ph_max=7.5,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=8.0,
        max_temp_c=25.0,
        drought_tolerance=0.2,
        flood_tolerance=0.15,
    ),
    "lettuce": CropRequirements(
        name="Lettuce",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=5.0,
        max_temp_c=25.0,
        drought_tolerance=0.15,
        flood_tolerance=0.1,
    ),
    "spinach": CropRequirements(
        name="Spinach",
        ph_min=6.5,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=5.0,
        max_temp_c=25.0,
        drought_tolerance=0.15,
        flood_tolerance=0.15,
    ),
    "pea": CropRequirements(
        name="Pea",
        ph_min=6.0,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=6.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=5.0,
        max_temp_c=25.0,
        drought_tolerance=0.3,
        flood_tolerance=0.15,
    ),
    "bean": CropRequirements(
        name="Bean (Common)",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=15.0,
        max_temp_c=30.0,
        drought_tolerance=0.3,
        flood_tolerance=0.1,
    ),
    "watermelon": CropRequirements(
        name="Watermelon",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=20.0,
        max_temp_c=38.0,
        drought_tolerance=0.4,
        flood_tolerance=0.1,
    ),
    "pumpkin": CropRequirements(
        name="Pumpkin / Squash",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=500,
        max_annual_rainfall_mm=1500,
        min_temp_c=18.0,
        max_temp_c=35.0,
        drought_tolerance=0.25,
        flood_tolerance=0.15,
    ),
    # ── Fruits ───────────────────────────────────────────────────────
    "banana": CropRequirements(
        name="Banana / Plantain",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam", "silty clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=12.0,
        min_cec_cmol_kg=15.0,
        min_annual_rainfall_mm=1200,
        max_annual_rainfall_mm=3000,
        min_temp_c=22.0,
        max_temp_c=35.0,
        drought_tolerance=0.15,
        flood_tolerance=0.3,
    ),
    "mango": CropRequirements(
        name="Mango",
        ph_min=5.5,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["loam", "sandy loam", "silt loam", "sandy clay loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=6.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=2500,
        min_temp_c=22.0,
        max_temp_c=40.0,
        drought_tolerance=0.6,
        flood_tolerance=0.1,
    ),
    "citrus": CropRequirements(
        name="Citrus (Orange / Lemon)",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=2000,
        min_temp_c=15.0,
        max_temp_c=38.0,
        drought_tolerance=0.4,
        flood_tolerance=0.1,
    ),
    "grape": CropRequirements(
        name="Grape (Vineyard)",
        ph_min=5.5,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam", "loamy sand"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=400,
        max_annual_rainfall_mm=1200,
        min_temp_c=10.0,
        max_temp_c=35.0,
        drought_tolerance=0.6,
        flood_tolerance=0.05,
    ),
    "apple": CropRequirements(
        name="Apple",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=1500,
        min_temp_c=5.0,
        max_temp_c=25.0,
        drought_tolerance=0.3,
        flood_tolerance=0.1,
    ),
    "avocado": CropRequirements(
        name="Avocado",
        ph_min=5.0,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=8.0,
        max_clay_pct=40.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=800,
        max_annual_rainfall_mm=2000,
        min_temp_c=15.0,
        max_temp_c=33.0,
        drought_tolerance=0.3,
        flood_tolerance=0.05,
    ),
    "papaya": CropRequirements(
        name="Papaya",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=8.0,
        max_clay_pct=35.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=1000,
        max_annual_rainfall_mm=2500,
        min_temp_c=22.0,
        max_temp_c=38.0,
        drought_tolerance=0.2,
        flood_tolerance=0.1,
    ),
    "pineapple": CropRequirements(
        name="Pineapple",
        ph_min=4.5,
        ph_max=6.0,
        min_awc_mm=40,
        preferred_textures=["sandy loam", "loam", "loamy sand"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        max_clay_pct=30.0,
        min_cec_cmol_kg=4.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=2500,
        min_temp_c=20.0,
        max_temp_c=38.0,
        drought_tolerance=0.6,
        flood_tolerance=0.05,
    ),
    "strawberry": CropRequirements(
        name="Strawberry",
        ph_min=5.5,
        ph_max=6.8,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=600,
        max_annual_rainfall_mm=1500,
        min_temp_c=8.0,
        max_temp_c=28.0,
        drought_tolerance=0.2,
        flood_tolerance=0.1,
    ),
    "olive": CropRequirements(
        name="Olive",
        ph_min=6.0,
        ph_max=8.5,
        min_awc_mm=40,
        preferred_textures=["loam", "sandy loam", "clay loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=4.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=300,
        max_annual_rainfall_mm=1000,
        min_temp_c=10.0,
        max_temp_c=38.0,
        drought_tolerance=0.8,
        flood_tolerance=0.05,
    ),
    "date_palm": CropRequirements(
        name="Date Palm",
        ph_min=7.0,
        ph_max=8.5,
        min_awc_mm=40,
        preferred_textures=["sandy loam", "loam", "loamy sand"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=3.0,
        min_cec_cmol_kg=3.0,
        min_annual_rainfall_mm=50,
        max_annual_rainfall_mm=300,
        min_temp_c=20.0,
        max_temp_c=45.0,
        drought_tolerance=0.95,
        flood_tolerance=0.05,
    ),
    "coconut": CropRequirements(
        name="Coconut",
        ph_min=5.0,
        ph_max=7.5,
        min_awc_mm=60,
        preferred_textures=["sandy loam", "loam", "loamy sand", "sandy clay loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
            "moderately well drained",
        ],
        min_soc_g_kg=5.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=1000,
        max_annual_rainfall_mm=3000,
        min_temp_c=22.0,
        max_temp_c=38.0,
        drought_tolerance=0.5,
        flood_tolerance=0.3,
    ),
    # ── Plantation & Beverage Crops ──────────────────────────────────
    "coffee": CropRequirements(
        name="Coffee",
        ph_min=5.0,
        ph_max=6.5,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=15.0,
        min_cec_cmol_kg=15.0,
        min_annual_rainfall_mm=1200,
        max_annual_rainfall_mm=2000,
        min_temp_c=15.0,
        max_temp_c=28.0,
        drought_tolerance=0.2,
        flood_tolerance=0.1,
    ),
    "cocoa": CropRequirements(
        name="Cocoa",
        ph_min=5.0,
        ph_max=7.0,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam", "silty clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=15.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=2500,
        min_temp_c=20.0,
        max_temp_c=32.0,
        drought_tolerance=0.1,
        flood_tolerance=0.15,
    ),
    "tea": CropRequirements(
        name="Tea",
        ph_min=4.5,
        ph_max=6.0,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=12.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=15.0,
        max_temp_c=28.0,
        drought_tolerance=0.15,
        flood_tolerance=0.15,
    ),
    "oil_palm": CropRequirements(
        name="Oil Palm",
        ph_min=4.0,
        ph_max=6.5,
        min_awc_mm=80,
        preferred_textures=["clay", "clay loam", "loam", "silty clay loam"],
        drainage_tolerance=[
            "well drained",
            "moderately well drained",
            "somewhat poorly drained",
        ],
        min_soc_g_kg=8.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=24.0,
        max_temp_c=35.0,
        drought_tolerance=0.15,
        flood_tolerance=0.3,
    ),
    "rubber": CropRequirements(
        name="Rubber",
        ph_min=4.5,
        ph_max=6.5,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam", "silty clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=1800,
        max_annual_rainfall_mm=3000,
        min_temp_c=22.0,
        max_temp_c=35.0,
        drought_tolerance=0.2,
        flood_tolerance=0.2,
    ),
    # ── Spices ───────────────────────────────────────────────────────
    "ginger": CropRequirements(
        name="Ginger",
        ph_min=5.5,
        ph_max=6.5,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=12.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.1,
        flood_tolerance=0.1,
    ),
    "turmeric": CropRequirements(
        name="Turmeric",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=80,
        preferred_textures=["loam", "sandy loam", "silt loam", "clay loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=2500,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.15,
        flood_tolerance=0.1,
    ),
    "black_pepper": CropRequirements(
        name="Black Pepper",
        ph_min=5.5,
        ph_max=6.5,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=15.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.1,
        flood_tolerance=0.1,
    ),
    "cardamom": CropRequirements(
        name="Cardamom",
        ph_min=5.0,
        ph_max=6.5,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=15.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=4000,
        min_temp_c=10.0,
        max_temp_c=30.0,
        drought_tolerance=0.1,
        flood_tolerance=0.1,
    ),
    "vanilla": CropRequirements(
        name="Vanilla",
        ph_min=6.0,
        ph_max=7.0,
        min_awc_mm=100,
        preferred_textures=["loam", "silt loam", "sandy loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=15.0,
        min_cec_cmol_kg=12.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=32.0,
        drought_tolerance=0.1,
        flood_tolerance=0.1,
    ),
    "cinnamon": CropRequirements(
        name="Cinnamon",
        ph_min=5.0,
        ph_max=6.5,
        min_awc_mm=80,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=10.0,
        min_cec_cmol_kg=8.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.2,
        flood_tolerance=0.15,
    ),
    "clove": CropRequirements(
        name="Clove",
        ph_min=5.0,
        ph_max=6.5,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=12.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.15,
        flood_tolerance=0.15,
    ),
    "nutmeg": CropRequirements(
        name="Nutmeg",
        ph_min=5.5,
        ph_max=7.0,
        min_awc_mm=100,
        preferred_textures=["loam", "clay loam", "silt loam"],
        drainage_tolerance=["well drained", "moderately well drained"],
        min_soc_g_kg=12.0,
        min_cec_cmol_kg=10.0,
        min_annual_rainfall_mm=1500,
        max_annual_rainfall_mm=3000,
        min_temp_c=20.0,
        max_temp_c=35.0,
        drought_tolerance=0.15,
        flood_tolerance=0.15,
    ),
    "saffron": CropRequirements(
        name="Saffron",
        ph_min=6.0,
        ph_max=8.0,
        min_awc_mm=40,
        preferred_textures=["sandy loam", "loam", "silt loam"],
        drainage_tolerance=[
            "well drained",
            "somewhat excessively drained",
        ],
        min_soc_g_kg=5.0,
        max_clay_pct=35.0,
        min_cec_cmol_kg=5.0,
        min_annual_rainfall_mm=300,
        max_annual_rainfall_mm=800,
        min_temp_c=5.0,
        max_temp_c=30.0,
        drought_tolerance=0.6,
        flood_tolerance=0.05,
    ),
}


# ── Sampling Zone Recommendations ───────────────────────────────────


def compute_sampling_zones(
    layers: list[dict],
    centroid_lat: float,
    centroid_lon: float,
    area_ha: float | None,
) -> list[dict]:
    """Suggest soil sampling locations based on within-field variability.

    For single-pixel profiles, generates zones based on property
    uncertainty and layer variability. Returns GeoJSON-compatible features.
    """
    zones: list[dict] = []

    if not layers:
        return zones

    # Analyze variability across properties and depths
    variability: dict[str, float] = {}

    # Clay variability (across depth)
    clay_vals = [
        lyr.get("clay_pct") for lyr in layers if lyr.get("clay_pct") is not None
    ]
    if len(clay_vals) >= 2:
        clay_range = max(clay_vals) - min(clay_vals)
        variability["clay"] = clay_range

    # SOC variability (significant if topsoil-subsoil difference is large)
    soc_top = [
        lyr.get("soc_g_kg")
        for lyr in layers
        if lyr.get("soc_g_kg") is not None and lyr["depth_top_cm"] < 30
    ]
    soc_deep = [
        lyr.get("soc_g_kg")
        for lyr in layers
        if lyr.get("soc_g_kg") is not None and lyr["depth_top_cm"] >= 30
    ]
    if soc_top and soc_deep:
        soc_diff = abs(sum(soc_top) / len(soc_top) - sum(soc_deep) / len(soc_deep))
        variability["soc"] = soc_diff

    # pH variability
    ph_vals = [lyr.get("ph") for lyr in layers if lyr.get("ph") is not None]
    if len(ph_vals) >= 2:
        ph_range = max(ph_vals) - min(ph_vals)
        variability["ph"] = ph_range

    # Uncertainty-based zones (from Q05/Q95 spread)
    top_layer = layers[0] if layers else None
    if top_layer:
        for prop, q05_key, q95_key in [
            ("clay", "clay_q05", "clay_q95"),
            ("soc", "soc_q05", "soc_q95"),
            ("ph", "ph_q05", "ph_q95"),
        ]:
            q05 = top_layer.get(q05_key)
            q95 = top_layer.get(q95_key)
            if q05 is not None and q95 is not None:
                spread = q95 - q05
                if prop not in variability:
                    variability[prop] = 0
                variability[prop] = max(variability[prop], spread)

    # Generate zones based on variability
    # Use small offsets from centroid for suggested sampling points
    r_deg = 0.001  # ~110m offset
    if area_ha and area_ha > 10:
        r_deg = min(0.005, math.sqrt(area_ha / 100) * 0.002)

    # Central reference point (always include)
    zones.append(
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [centroid_lon, centroid_lat]},
            "properties": {
                "zone_type": "reference",
                "priority": 1,
                "rationale": "Field centroid - baseline reference point",
            },
        }
    )

    # High-clay variability zone
    if variability.get("clay", 0) > 8:
        zones.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [centroid_lon + r_deg, centroid_lat + r_deg],
                },
                "properties": {
                    "zone_type": "high_clay_variability",
                    "priority": 2,
                    "rationale": f"High clay variation ({variability['clay']:.0f}% range across depths)"
                    " - verify texture transition",
                },
            }
        )

    # High-SOC variability zone
    if variability.get("soc", 0) > 5:
        zones.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [centroid_lon - r_deg, centroid_lat + r_deg],
                },
                "properties": {
                    "zone_type": "high_soc_variability",
                    "priority": 2,
                    "rationale": f"High SOC variation ({variability['soc']:.1f} g/kg difference)"
                    " - check organic matter distribution",
                },
            }
        )

    # pH concern zone
    if variability.get("ph", 0) > 0.8:
        zones.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [centroid_lon + r_deg, centroid_lat - r_deg],
                },
                "properties": {
                    "zone_type": "ph_variability",
                    "priority": 2 if variability["ph"] > 1.5 else 3,
                    "rationale": f"pH varies by {variability['ph']:.1f} units across depth"
                    " - check liming needs",
                },
            }
        )

    # AWC concern zone (if extremes across depth)
    awc_vals = [lyr.get("awc_mm") for lyr in layers if lyr.get("awc_mm") is not None]
    if awc_vals and len(awc_vals) >= 2:
        awc_cv = (max(awc_vals) - min(awc_vals)) / (sum(awc_vals) / len(awc_vals))
        if awc_cv > 0.5:
            zones.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [centroid_lon - r_deg, centroid_lat - r_deg],
                    },
                    "properties": {
                        "zone_type": "water_holding_variability",
                        "priority": 3,
                        "rationale": "High AWC variability - verify water-holding capacity",
                    },
                }
            )

    # Edge zone for larger fields
    if area_ha and area_ha > 20:
        zones.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        centroid_lon + r_deg * 1.5,
                        centroid_lat,
                    ],
                },
                "properties": {
                    "zone_type": "field_boundary",
                    "priority": 3,
                    "rationale": "Field boundary zone - edge effects and compaction risk",
                },
            }
        )

    return zones


# ── Crop Suitability ─────────────────────────────────────────────────


@dataclass
class CropSuitabilityResult:
    crop: str  # machine key (e.g. "oil_palm")
    name: str  # display name (e.g. "Oil Palm")
    score: float  # 0 – 100
    rating: str  # excellent / good / moderate / poor
    limiting_factors: list[str] = field(default_factory=list)


def assess_crop_suitability(
    summary: dict,
    layers: list[dict] | None = None,
    weather_summary: dict | None = None,
) -> list[CropSuitabilityResult]:
    """Score all crops using 4-pillar weighted system.

    Pillars (when weather available):
        Soil Fit (40%) + Water Match (25%) + Climate Fit (20%) + Stress Resilience (15%)
    Without weather data returns empty list - caller should block.

    Args:
        summary: Field soil summary dict (avg_ph, rootzone_awc_mm, etc.)
        layers: Raw soil profile layers with per-depth properties.
        weather_summary: Dict with keys: annual_rainfall_mm, avg_temp_c,
            min_temp_c, max_temp_c, water_balance_30d_mm, drought_index,
            drought_severity (0-1 float, None if no active drought).

    Returns sorted list (highest score first), top 10.
    """
    if weather_summary is None:
        return []

    results: list[CropSuitabilityResult] = []

    avg_ph = summary.get("avg_ph")
    awc_mm = summary.get("rootzone_awc_mm")
    texture = summary.get("dominant_texture")
    drainage = summary.get("drainage_class")

    # Topsoil SOC from layers
    topsoil_soc = None
    topsoil_clay = None
    topsoil_cec = None
    if layers:
        soc_vals = [
            lyr.get("soc_g_kg")
            for lyr in layers
            if lyr.get("soc_g_kg") is not None and lyr["depth_top_cm"] < 30
        ]
        if soc_vals:
            topsoil_soc = sum(soc_vals) / len(soc_vals)

        clay_vals = [
            lyr.get("clay_pct")
            for lyr in layers
            if lyr.get("clay_pct") is not None and lyr["depth_top_cm"] < 30
        ]
        if clay_vals:
            topsoil_clay = sum(clay_vals) / len(clay_vals)

        cec_vals = [
            lyr.get("cec_cmol_kg")
            for lyr in layers
            if lyr.get("cec_cmol_kg") is not None and lyr["depth_top_cm"] < 30
        ]
        if cec_vals:
            topsoil_cec = sum(cec_vals) / len(cec_vals)

    # Extract weather data
    annual_rain = weather_summary.get("annual_rainfall_mm")
    avg_temp = weather_summary.get("avg_temp_c")
    min_temp = weather_summary.get("min_temp_c")
    max_temp = weather_summary.get("max_temp_c")
    water_balance = weather_summary.get("water_balance_30d_mm")
    drought_idx = weather_summary.get("drought_index")
    drought_severity = weather_summary.get("drought_severity")

    for crop_key, req in CROP_PROFILES.items():
        limiting: list[str] = []

        # ── Pillar 1: Soil Fit (40%) ──────────────────────────────
        soil_score = 1.0

        # pH
        if avg_ph is not None:
            if not (req.ph_min <= avg_ph <= req.ph_max):
                ph_dist = max(req.ph_min - avg_ph, avg_ph - req.ph_max, 0)
                soil_score *= 1.0 - min(1.0, ph_dist / 2.0) * 0.4
                if ph_dist > 0.5:
                    limiting.append(
                        f"pH {avg_ph:.1f} outside optimal {req.ph_min}–{req.ph_max}"
                    )

        # AWC
        if awc_mm is not None and req.min_awc_mm > 0:
            if awc_mm < req.min_awc_mm:
                ratio = awc_mm / req.min_awc_mm
                soil_score *= max(0.3, ratio)
                if ratio < 0.8:
                    limiting.append(
                        f"AWC {awc_mm:.0f}mm below {req.min_awc_mm:.0f}mm minimum"
                    )

        # Texture
        if texture and texture not in req.preferred_textures:
            soil_score *= 0.75
            limiting.append(f"Texture '{texture}' not preferred")

        # Drainage
        if drainage and drainage not in req.drainage_tolerance:
            soil_score *= 0.65
            limiting.append(f"Drainage '{drainage}' not suitable")

        # SOC
        if topsoil_soc is not None and req.min_soc_g_kg > 0:
            if topsoil_soc < req.min_soc_g_kg:
                ratio = topsoil_soc / req.min_soc_g_kg
                soil_score *= max(0.5, ratio)
                if ratio < 0.8:
                    limiting.append(
                        f"SOC {topsoil_soc:.1f}g/kg below {req.min_soc_g_kg:.0f}g/kg"
                    )

        # Clay constraints
        if topsoil_clay is not None:
            if topsoil_clay > req.max_clay_pct:
                soil_score *= 0.6
                limiting.append(
                    f"Clay {topsoil_clay:.0f}% exceeds {req.max_clay_pct:.0f}% max"
                )
            if topsoil_clay < req.min_clay_pct:
                soil_score *= 0.7
                limiting.append(
                    f"Clay {topsoil_clay:.0f}% below {req.min_clay_pct:.0f}% min"
                )

        # CEC
        if topsoil_cec is not None and req.min_cec_cmol_kg > 0:
            if topsoil_cec < req.min_cec_cmol_kg:
                ratio = topsoil_cec / req.min_cec_cmol_kg
                soil_score *= max(0.5, ratio)
                if ratio < 0.7:
                    limiting.append(
                        f"CEC {topsoil_cec:.1f} below {req.min_cec_cmol_kg:.0f} cmol/kg"
                    )

        # ── Pillar 2: Water Match (25%) ───────────────────────────
        water_score = 1.0

        if annual_rain is not None:
            if annual_rain < req.min_annual_rainfall_mm:
                ratio = (
                    annual_rain / req.min_annual_rainfall_mm
                    if req.min_annual_rainfall_mm > 0
                    else 1
                )
                water_score *= max(0.2, ratio)
                if ratio < 0.7:
                    limiting.append(
                        f"Rainfall {annual_rain:.0f}mm below {req.min_annual_rainfall_mm:.0f}mm min"
                    )
            elif annual_rain > req.max_annual_rainfall_mm:
                excess = (
                    annual_rain / req.max_annual_rainfall_mm
                    if req.max_annual_rainfall_mm > 0
                    else 1
                )
                water_score *= max(0.3, 1.0 / excess)
                if excess > 1.5:
                    limiting.append(
                        f"Rainfall {annual_rain:.0f}mm exceeds {req.max_annual_rainfall_mm:.0f}mm max"
                    )

        if water_balance is not None and water_balance < -50:
            deficit_penalty = min(0.4, abs(water_balance) / 500)
            water_score *= 1.0 - deficit_penalty
            if water_balance < -100:
                limiting.append(f"Water deficit {water_balance:.0f}mm (30-day)")

        # ── Pillar 3: Climate Fit (20%) ───────────────────────────
        climate_score = 1.0

        if avg_temp is not None:
            if avg_temp < req.min_temp_c:
                gap = req.min_temp_c - avg_temp
                climate_score *= max(0.2, 1.0 - gap / 15.0)
                if gap > 3:
                    limiting.append(
                        f"Avg temp {avg_temp:.1f}°C below {req.min_temp_c:.0f}°C min"
                    )
            elif avg_temp > req.max_temp_c:
                gap = avg_temp - req.max_temp_c
                climate_score *= max(0.2, 1.0 - gap / 15.0)
                if gap > 3:
                    limiting.append(
                        f"Avg temp {avg_temp:.1f}°C above {req.max_temp_c:.0f}°C max"
                    )

        if min_temp is not None and min_temp < req.min_temp_c - 5:
            frost_gap = (req.min_temp_c - 5) - min_temp
            climate_score *= max(0.3, 1.0 - frost_gap / 20.0)
            if frost_gap > 5:
                limiting.append(f"Extreme cold {min_temp:.0f}°C risks frost damage")

        if max_temp is not None and max_temp > req.max_temp_c + 5:
            heat_gap = max_temp - (req.max_temp_c + 5)
            climate_score *= max(0.3, 1.0 - heat_gap / 20.0)
            if heat_gap > 5:
                limiting.append(f"Extreme heat {max_temp:.0f}°C risks heat stress")

        # ── Pillar 4: Stress Resilience (15%) ─────────────────────
        stress_score = 1.0

        if drought_severity is not None and drought_severity > 0:
            vulnerability = 1.0 - req.drought_tolerance
            stress_score *= max(0.1, 1.0 - drought_severity * vulnerability)
            if drought_severity > 0.4 and req.drought_tolerance < 0.4:
                limiting.append(
                    f"Low drought tolerance ({req.drought_tolerance:.0%}) under active drought"
                )

        # Flood/waterlogging: positive drought_idx indicates wet conditions
        if drought_idx is not None and drought_idx > 1.0:
            flood_severity = min(1.0, (drought_idx - 1.0) / 2.0)
            vulnerability = 1.0 - req.flood_tolerance
            stress_score *= max(0.1, 1.0 - flood_severity * vulnerability)
            if flood_severity > 0.3 and req.flood_tolerance < 0.3:
                limiting.append(
                    f"Low flood tolerance ({req.flood_tolerance:.0%}) under wet conditions"
                )

        # ── Weighted combination ──────────────────────────────────
        combined = (
            soil_score * 0.40
            + water_score * 0.25
            + climate_score * 0.20
            + stress_score * 0.15
        )

        score_pct = round(max(0.0, min(100.0, combined * 100)), 1)
        rating = _score_to_rating(combined)
        results.append(
            CropSuitabilityResult(
                crop=crop_key,
                name=req.name,
                score=score_pct,
                rating=rating,
                limiting_factors=limiting,
            )
        )

    results.sort(key=lambda r: r.score, reverse=True)
    return results


def _score_to_rating(score: float) -> str:
    if score > 0.8:
        return "excellent"
    if score > 0.6:
        return "good"
    if score > 0.4:
        return "moderate"
    return "poor"


# ── Nutrient-Risk Zone Classification ────────────────────────────────


@dataclass
class NutrientContext:
    zone_class: str  # nutrient_responsive | nutrient_retentive | nutrient_loss_risk
    confidence: float  # 0–1
    factors: list[str]
    interpretation: str


def classify_nutrient_risk(
    summary: dict,
    layers: list[dict] | None = None,
) -> NutrientContext:
    """Classify the field's nutrient risk zone (NOT a fertilizer recommendation)."""
    ph = summary.get("avg_ph")
    leaching = summary.get("leaching_risk")

    # Layer-level CEC and SOC
    cec_vals: list[float] = []
    soc_vals: list[float] = []
    sand_vals: list[float] = []
    clay_vals: list[float] = []

    if layers:
        for lyr in layers:
            if lyr.get("cec_cmol_kg") is not None:
                cec_vals.append(lyr["cec_cmol_kg"])
            if lyr.get("soc_g_kg") is not None:
                soc_vals.append(lyr["soc_g_kg"])
            if lyr.get("sand_pct") is not None:
                sand_vals.append(lyr["sand_pct"])
            if lyr.get("clay_pct") is not None:
                clay_vals.append(lyr["clay_pct"])

    avg_cec = sum(cec_vals) / len(cec_vals) if cec_vals else None
    avg_soc = sum(soc_vals) / len(soc_vals) if soc_vals else None
    avg_sand = sum(sand_vals) / len(sand_vals) if sand_vals else None
    avg_clay = sum(clay_vals) / len(clay_vals) if clay_vals else None

    factors: list[str] = []
    loss_score = 0.0
    retain_score = 0.0
    responsive_score = 0.0

    # CEC-based classification
    if avg_cec is not None:
        if avg_cec < 5:
            loss_score += 0.35
            factors.append(f"Very low CEC ({avg_cec:.1f} cmol/kg)")
        elif avg_cec < 12:
            responsive_score += 0.25
            factors.append(f"Moderate CEC ({avg_cec:.1f} cmol/kg)")
        else:
            retain_score += 0.35
            factors.append(f"High CEC ({avg_cec:.1f} cmol/kg)")

    # Sand/clay-based
    if avg_sand is not None and avg_sand > 70:
        loss_score += 0.25
        factors.append(f"High sand ({avg_sand:.0f}%)")
    elif avg_clay is not None and avg_clay > 35:
        retain_score += 0.25
        factors.append(f"High clay ({avg_clay:.0f}%)")

    # SOC-based
    if avg_soc is not None:
        if avg_soc < 10:
            responsive_score += 0.2
            factors.append(f"Low SOC ({avg_soc:.1f} g/kg)")
        elif avg_soc > 25:
            retain_score += 0.15
            factors.append(f"High SOC ({avg_soc:.1f} g/kg)")

    # pH-based
    if ph is not None:
        if ph < 5.5:
            responsive_score += 0.15
            factors.append(f"Acidic pH ({ph:.1f})")
        elif ph > 7.5:
            responsive_score += 0.1
            factors.append(f"Alkaline pH ({ph:.1f})")

    # Leaching risk integration
    if leaching is not None and leaching > 0.5:
        loss_score += 0.2
        factors.append(f"High leaching risk ({leaching:.2f})")

    # Determine dominant classification
    scores = {
        "nutrient_loss_risk": loss_score,
        "nutrient_retentive": retain_score,
        "nutrient_responsive": responsive_score,
    }
    zone_class = max(scores, key=scores.get)  # type: ignore[arg-type]
    confidence = scores[zone_class] / max(sum(scores.values()), 0.01)

    interpretations = {
        "nutrient_loss_risk": (
            "This soil has a high risk of nutrient leaching due to coarse "
            "texture and/or low cation exchange capacity. Applied nutrients "
            "may be lost quickly through drainage."
        ),
        "nutrient_retentive": (
            "This soil has good nutrient retention characteristics due to "
            "fine texture, high CEC, and/or organic matter content. Applied "
            "nutrients are likely to remain plant-available."
        ),
        "nutrient_responsive": (
            "This soil is likely to respond well to nutrient inputs due to "
            "moderate capacity with room for improvement. Targeted "
            "amendments may be particularly effective."
        ),
    }

    return NutrientContext(
        zone_class=zone_class,
        confidence=round(confidence, 2),
        factors=factors,
        interpretation=interpretations[zone_class],
    )


# ── Carbon Sequestration Potential ───────────────────────────────────


@dataclass
class CarbonEstimate:
    current_soc_stock_t_ha: float | None
    topsoil_soc_stock_t_ha: float | None
    estimated_soc_saturation_t_ha: float | None
    saturation_pct: float | None
    sequestration_potential_t_ha: tuple[float, float] | None  # (low, high) range
    climate_zone: str | None
    disclaimer: str


def estimate_sequestration_potential(
    summary: dict,
    layers: list[dict] | None,
    annual_precip_mm: float | None = None,
    annual_temp_c: float | None = None,
) -> CarbonEstimate:
    """Estimate carbon sequestration opportunity.

    Uses texture-dependent SOC saturation deficit concept.
    Wide uncertainty ranges to reflect estimation limitations.
    """
    current_soc = summary.get("total_soc_stock_t_ha")
    topsoil_soc = summary.get("topsoil_soc_stock_t_ha")
    texture = summary.get("dominant_texture")

    # Determine climate zone from weather data
    climate_zone = _classify_climate_zone(annual_precip_mm, annual_temp_c)

    # Estimate SOC saturation based on texture + climate
    # Theoretical max SOC stock varies by texture and climate
    # Based on published literature ranges (Hassink 1997, Six et al. 2002)
    saturation = _estimate_soc_saturation(texture, climate_zone, layers)

    saturation_pct = None
    seq_potential = None

    if current_soc is not None and saturation is not None and saturation > 0:
        saturation_pct = round(min(100.0, current_soc / saturation * 100), 1)
        deficit = max(0, saturation - current_soc)
        # Wide range reflecting uncertainty: 30-70% of deficit achievable
        if deficit > 0:
            seq_potential = (round(deficit * 0.3, 1), round(deficit * 0.7, 1))

    return CarbonEstimate(
        current_soc_stock_t_ha=current_soc,
        topsoil_soc_stock_t_ha=topsoil_soc,
        estimated_soc_saturation_t_ha=saturation,
        saturation_pct=saturation_pct,
        sequestration_potential_t_ha=seq_potential,
        climate_zone=climate_zone,
        disclaimer=(
            "These are rough estimates based on soil type and climate zone. "
            "Not suitable for carbon credit verification. Actual sequestration "
            "depends on management practices, crop residue inputs, and local conditions."
        ),
    )


def _classify_climate_zone(
    precip_mm: float | None,
    temp_c: float | None,
) -> str | None:
    """Broad climate zone classification from annual averages."""
    if precip_mm is None or temp_c is None:
        return None
    if temp_c > 20:
        return (
            "tropical_humid"
            if precip_mm > 1500
            else ("tropical_subhumid" if precip_mm > 800 else "tropical_arid")
        )
    if temp_c > 10:
        return (
            "temperate_humid"
            if precip_mm > 800
            else ("temperate_subhumid" if precip_mm > 400 else "temperate_arid")
        )
    return "boreal" if precip_mm > 400 else "cold_arid"


def _estimate_soc_saturation(
    texture: str | None,
    climate_zone: str | None,
    layers: list[dict] | None,
) -> float | None:
    """Estimate theoretical SOC saturation for the full 0-200cm profile.

    Based on clay-dependent protective capacity (Hassink 1997) and
    climate-dependent turnover rates.
    """
    # Get average clay % from layers
    avg_clay: float | None = None
    if layers:
        clay_vals = [
            lyr.get("clay_pct") for lyr in layers if lyr.get("clay_pct") is not None
        ]
        if clay_vals:
            avg_clay = sum(clay_vals) / len(clay_vals)

    if avg_clay is None:
        # Rough texture-based estimate
        texture_clay: dict[str, float] = {
            "sand": 5,
            "loamy sand": 8,
            "sandy loam": 12,
            "loam": 20,
            "silt loam": 18,
            "silt": 10,
            "sandy clay loam": 25,
            "clay loam": 32,
            "silty clay loam": 30,
            "sandy clay": 40,
            "silty clay": 45,
            "clay": 50,
        }
        avg_clay = texture_clay.get(texture or "", 20)

    # Hassink (1997): max C_protected ≈ 4.09 + 0.37 × clay%  (g C / kg soil, topsoil)
    # We extend to full profile with depth decay
    topsoil_max_c = 4.09 + 0.37 * avg_clay  # g C / kg soil

    # Climate adjustment factor
    climate_factors = {
        "tropical_humid": 1.3,
        "tropical_subhumid": 1.0,
        "tropical_arid": 0.6,
        "temperate_humid": 1.2,
        "temperate_subhumid": 0.9,
        "temperate_arid": 0.5,
        "boreal": 1.4,
        "cold_arid": 0.4,
    }
    c_factor = climate_factors.get(climate_zone or "", 1.0)

    # Convert topsoil C capacity to full-profile SOC stock (t/ha)
    # Assume BD ~1.3, depth distribution with ~60% in top 30cm
    # topsoil_max_c is g/kg; × BD × 30cm depth × 10 = t/ha for 0-30cm
    topsoil_stock = topsoil_max_c * 1.3 * 30 * 0.01 * c_factor
    # Full profile ≈ topsoil / 0.6 (topsoil contains ~60% of total C)
    full_profile = topsoil_stock / 0.6

    return round(full_profile, 1)


# ── Weather × Soil Stress Indicators ────────────────────────────────


@dataclass
class SoilWeatherStress:
    status: str  # drought_stress | optimal | wet_stress
    severity: float  # 0-1
    moisture_status: str  # descriptive
    awc_rootzone_mm: float | None
    water_balance_30d_mm: float | None
    factors: list[str]


def compute_soil_weather_stress(
    summary: dict,
    water_balance_30d_mm: float | None,
    drought_index: float | None = None,
    soil_moisture_top: float | None = None,
) -> SoilWeatherStress:
    """Combine soil AWC with recent weather to estimate root-zone stress."""
    awc = summary.get("rootzone_awc_mm")
    drainage = summary.get("drainage_class")

    factors: list[str] = []
    status = "optimal"
    severity = 0.0

    if awc is None or water_balance_30d_mm is None:
        return SoilWeatherStress(
            status="unknown",
            severity=0.0,
            moisture_status="Insufficient data to assess",
            awc_rootzone_mm=awc,
            water_balance_30d_mm=water_balance_30d_mm,
            factors=["Missing soil AWC or weather data"],
        )

    # Drought stress: water deficit exceeds soil storage capacity
    if water_balance_30d_mm < -awc:
        severity = min(1.0, abs(water_balance_30d_mm + awc) / awc) if awc > 0 else 0.5
        status = "drought_stress"
        factors.append(
            f"Water deficit ({water_balance_30d_mm:.0f}mm) exceeds "
            f"rootzone capacity ({awc:.0f}mm)"
        )

    # Waterlogging: water excess + poor drainage
    elif water_balance_30d_mm > awc:
        poor_drainage = drainage in (
            "poorly drained",
            "very poorly drained",
            "somewhat poorly drained",
        )
        if poor_drainage:
            severity = min(1.0, (water_balance_30d_mm - awc) / awc) if awc > 0 else 0.5
            status = "wet_stress"
            factors.append(
                f"Water surplus ({water_balance_30d_mm:.0f}mm) with "
                f"poor drainage ({drainage})"
            )
        else:
            # Moderate excess but reasonable drainage
            severity = (
                min(0.4, (water_balance_30d_mm - awc) / (awc * 2)) if awc > 0 else 0.2
            )
            if severity > 0.2:
                status = "wet_stress"
                factors.append(f"Moderate water surplus ({water_balance_30d_mm:.0f}mm)")
    else:
        # Within bounds - check if approaching stress
        water_ratio = water_balance_30d_mm / awc if awc > 0 else 0
        if water_ratio < -0.5:
            severity = 0.3
            status = "approaching_drought"
            factors.append("Water balance trending toward deficit")

    # Additional context from drought index
    if drought_index is not None:
        if drought_index < -1.5:
            severity = max(severity, 0.6)
            if status == "optimal":
                status = "drought_stress"
            factors.append(f"Drought index: {drought_index:.1f}")
        elif drought_index > 1.5:
            severity = max(severity, 0.4)
            if status == "optimal":
                status = "wet_stress"
            factors.append(f"Wet anomaly index: {drought_index:.1f}")

    # Soil moisture crosscheck
    if soil_moisture_top is not None:
        if soil_moisture_top < 0.1 and status != "wet_stress":
            severity = max(severity, 0.4)
            factors.append(f"Very low top-soil moisture ({soil_moisture_top:.3f})")
        elif soil_moisture_top > 0.4 and status != "drought_stress":
            factors.append(f"High top-soil moisture ({soil_moisture_top:.3f})")

    statuses = {
        "drought_stress": "Dry stress - water deficit exceeds rootzone capacity",
        "approaching_drought": "Approaching moisture deficit",
        "optimal": "Adequate moisture conditions",
        "wet_stress": "Wet stress - waterlogging risk present",
        "unknown": "Insufficient data",
    }

    return SoilWeatherStress(
        status=status,
        severity=round(severity, 2),
        moisture_status=statuses.get(status, "Unknown"),
        awc_rootzone_mm=awc,
        water_balance_30d_mm=water_balance_30d_mm,
        factors=factors,
    )


# ── Soil Alert Evaluation ───────────────────────────────────────────

# Default thresholds for soil-based alerts
SOIL_ALERT_THRESHOLDS = {
    "soil_ph_low": {"threshold": 5.5, "severity": "medium", "direction": "below"},
    "soil_ph_very_low": {"threshold": 4.5, "severity": "high", "direction": "below"},
    "soil_soc_low": {
        "threshold": 10.0,
        "severity": "medium",
        "direction": "below",
    },  # g/kg
    "soil_soc_very_low": {"threshold": 5.0, "severity": "high", "direction": "below"},
    "soil_sand_high": {"threshold": 80.0, "severity": "medium", "direction": "above"},
    "soil_cec_low": {
        "threshold": 5.0,
        "severity": "medium",
        "direction": "below",
    },  # cmol/kg
    "soil_compaction": {
        "threshold": 0.6,
        "severity": "medium",
        "direction": "above",
    },  # risk 0-1
    "soil_waterlogging": {"threshold": 0.6, "severity": "medium", "direction": "above"},
}


@dataclass
class SoilAlertCandidate:
    rule_name: str
    severity: str
    message: str
    soil_context: dict


def evaluate_soil_alerts(
    summary: dict,
    layers: list[dict],
) -> list[SoilAlertCandidate]:
    """Evaluate soil properties against alert thresholds.

    Returns a list of alert candidates to be created.
    """
    alerts: list[SoilAlertCandidate] = []
    ph = summary.get("avg_ph")
    compaction = summary.get("compaction_risk")
    waterlogging = summary.get("waterlogging_risk")
    drainage = summary.get("drainage_class")

    # Get topsoil properties
    topsoil = [lyr for lyr in layers if lyr["depth_top_cm"] < 30]
    topsoil_soc = None
    topsoil_sand = None
    topsoil_cec = None

    if topsoil:
        soc_vals = [
            lyr.get("soc_g_kg") for lyr in topsoil if lyr.get("soc_g_kg") is not None
        ]
        if soc_vals:
            topsoil_soc = sum(soc_vals) / len(soc_vals)
        sand_vals = [
            lyr.get("sand_pct") for lyr in topsoil if lyr.get("sand_pct") is not None
        ]
        if sand_vals:
            topsoil_sand = sum(sand_vals) / len(sand_vals)
        cec_vals = [
            lyr.get("cec_cmol_kg")
            for lyr in topsoil
            if lyr.get("cec_cmol_kg") is not None
        ]
        if cec_vals:
            topsoil_cec = sum(cec_vals) / len(cec_vals)

    # pH alerts
    if ph is not None:
        if ph < 4.5:
            alerts.append(
                SoilAlertCandidate(
                    rule_name="soil_ph_very_low",
                    severity="high",
                    message=f"Very low soil pH ({ph:.1f}) - aluminum toxicity risk",
                    soil_context={"ph": ph, "threshold": 4.5},
                )
            )
        elif ph < 5.5:
            alerts.append(
                SoilAlertCandidate(
                    rule_name="soil_ph_low",
                    severity="medium",
                    message=f"Low soil pH ({ph:.1f}) - may limit nutrient availability",
                    soil_context={"ph": ph, "threshold": 5.5},
                )
            )

    # SOC alerts
    if topsoil_soc is not None:
        if topsoil_soc < 5.0:
            alerts.append(
                SoilAlertCandidate(
                    rule_name="soil_soc_very_low",
                    severity="high",
                    message=f"Very low organic carbon ({topsoil_soc:.1f} g/kg) - soil health concern",
                    soil_context={
                        "soc_g_kg": round(topsoil_soc, 1),
                        "depth": "0-30cm",
                        "threshold": 5.0,
                    },
                )
            )
        elif topsoil_soc < 10.0:
            alerts.append(
                SoilAlertCandidate(
                    rule_name="soil_soc_low",
                    severity="medium",
                    message=f"Low organic carbon ({topsoil_soc:.1f} g/kg) - consider organic amendments",
                    soil_context={
                        "soc_g_kg": round(topsoil_soc, 1),
                        "depth": "0-30cm",
                        "threshold": 10.0,
                    },
                )
            )

    # Sand alert - high leaching risk
    if topsoil_sand is not None and topsoil_sand > 80:
        alerts.append(
            SoilAlertCandidate(
                rule_name="soil_sand_high",
                severity="medium",
                message=f"High sand content ({topsoil_sand:.0f}%) - high nutrient leaching risk",
                soil_context={"sand_pct": round(topsoil_sand, 1), "threshold": 80.0},
            )
        )

    # CEC alert - low nutrient retention
    if topsoil_cec is not None and topsoil_cec < 5.0:
        alerts.append(
            SoilAlertCandidate(
                rule_name="soil_cec_low",
                severity="medium",
                message=f"Very low CEC ({topsoil_cec:.1f} cmol/kg) - poor nutrient retention",
                soil_context={"cec_cmol_kg": round(topsoil_cec, 1), "threshold": 5.0},
            )
        )

    # Compaction risk alert
    if compaction is not None and compaction > 0.6:
        alerts.append(
            SoilAlertCandidate(
                rule_name="soil_compaction",
                severity="high" if compaction > 0.8 else "medium",
                message=f"High compaction risk (score: {compaction:.2f}) - may restrict root growth",
                soil_context={"compaction_risk": compaction, "threshold": 0.6},
            )
        )

    # Waterlogging risk alert
    if waterlogging is not None and waterlogging > 0.6:
        alerts.append(
            SoilAlertCandidate(
                rule_name="soil_waterlogging",
                severity="high" if waterlogging > 0.8 else "medium",
                message=f"High waterlogging risk (score: {waterlogging:.2f})"
                + (f" with {drainage}" if drainage else ""),
                soil_context={
                    "waterlogging_risk": waterlogging,
                    "drainage_class": drainage,
                    "threshold": 0.6,
                },
            )
        )

    return alerts
