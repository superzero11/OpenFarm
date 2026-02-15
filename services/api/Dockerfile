FROM python:3.12-slim

WORKDIR /app

# Install system deps for PostGIS/GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev gcc g++ curl && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[all]" 2>/dev/null || pip install --no-cache-dir .

COPY . .

# Run migrations (with retry for DB readiness) then start API
CMD ["sh", "-c", "for i in 1 2 3 4 5 6 7 8 9 10; do alembic upgrade head && break || echo \"Waiting for DB... attempt $i\" && sleep 3; done && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
