# ── ML-Processor Dockerfile ──────────────────────────────────────────
# Separate image for boundary-detection tasks.
# Includes PyTorch (CPU-only) + ftw-tools on top of the base API deps.
# Uses the same app code but runs a Celery worker consuming the "ml" queue.
#
# Layer strategy: deps are cached; only app code (COPY . .) changes on edits.
# Normal rebuild:  docker compose build ml-processor      (~30s, cached deps)
# Deps changed:    docker compose build ml-processor      (auto-invalidates)
# ─────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

# Install system deps for PostGIS/GDAL (same as api Dockerfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev gcc g++ curl && \
    rm -rf /var/lib/apt/lists/*

# ── Dependency layers (cached unless pyproject.toml or requirements-ml.txt change) ──
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[all]" 2>/dev/null || pip install --no-cache-dir .

COPY requirements-ml.txt .
RUN pip install --no-cache-dir -r requirements-ml.txt

# ── App code (changes frequently — this layer rebuilds on every code edit) ──
COPY . .

# Create model cache directory
RUN mkdir -p /tmp/models

# Run as non-root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app /tmp/models
USER appuser

CMD ["celery", "-A", "app.worker", "worker", "-Q", "ml", "--loglevel=info", "--concurrency=2"]
