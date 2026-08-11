#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# OpenFarm - Automated PostgreSQL Backup Script
#
# Usage:
#   ./deploy/backup.sh              # Manual run
#   RETENTION_DAYS=14 ./backup.sh   # Override retention
#
# Cron (daily at 02:00 UTC):
#   0 2 * * * /opt/openfarm/deploy/backup.sh >> /var/log/openfarm-backup.log 2>&1
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
COMPOSE_DIR="${COMPOSE_DIR:-/opt/openfarm}"
BACKUP_DIR="${BACKUP_DIR:-/opt/openfarm/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-openfarm}"
DB_NAME="${DB_NAME:-openfarm}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="openfarm_${TIMESTAMP}.sql.gz"

# Optional: upload to MinIO/S3
UPLOAD_TO_MINIO="${UPLOAD_TO_MINIO:-false}"
MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_BUCKET="${MINIO_BUCKET:-openfarm}"
MINIO_BACKUP_PREFIX="${MINIO_BACKUP_PREFIX:-backups}"

# ── Functions ─────────────────────────────────────────────────

log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
}

die() {
    log "ERROR: $*" >&2
    exit 1
}

# ── Pre-checks ────────────────────────────────────────────────

command -v docker >/dev/null 2>&1 || die "docker not found"
mkdir -p "${BACKUP_DIR}"

# Verify DB container is running
cd "${COMPOSE_DIR}"
docker compose ps "${DB_SERVICE}" --format '{{.State}}' 2>/dev/null | grep -qi running \
    || die "Database container '${DB_SERVICE}' is not running"

# ── Backup ────────────────────────────────────────────────────

log "Starting backup → ${BACKUP_FILE}"

docker compose exec -T "${DB_SERVICE}" \
    pg_dump -U "${DB_USER}" --format=custom --compress=6 "${DB_NAME}" \
    > "${BACKUP_DIR}/${BACKUP_FILE%.gz}" 2>/dev/null

# Use custom format (-Fc) which is already compressed, rename accordingly
BACKUP_FILE="openfarm_${TIMESTAMP}.dump"
mv "${BACKUP_DIR}/openfarm_${TIMESTAMP}.sql" "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null || true

# Fall back to plain SQL + gzip if custom format fails
if [ ! -s "${BACKUP_DIR}/${BACKUP_FILE}" ] 2>/dev/null; then
    BACKUP_FILE="openfarm_${TIMESTAMP}.sql.gz"
    docker compose exec -T "${DB_SERVICE}" \
        pg_dump -U "${DB_USER}" "${DB_NAME}" \
        | gzip -9 > "${BACKUP_DIR}/${BACKUP_FILE}"
fi

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Upload to MinIO (optional) ───────────────────────────────

if [ "${UPLOAD_TO_MINIO}" = "true" ]; then
    if command -v mc >/dev/null 2>&1; then
        log "Uploading to MinIO: ${MINIO_ALIAS}/${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/"
        mc cp "${BACKUP_DIR}/${BACKUP_FILE}" \
            "${MINIO_ALIAS}/${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${BACKUP_FILE}"
        log "Upload complete"
    else
        log "WARNING: mc (MinIO client) not found - skipping upload"
    fi
fi

# ── Retention - delete backups older than N days ──────────────

log "Pruning local backups older than ${RETENTION_DAYS} days..."
PRUNED=$(find "${BACKUP_DIR}" -name "openfarm_*.dump" -o -name "openfarm_*.sql.gz" \
    | while read -r f; do
        if [ "$(find "$f" -mtime +"${RETENTION_DAYS}" 2>/dev/null)" ]; then
            rm -f "$f"
            echo "$f"
        fi
    done | wc -l)
log "Pruned ${PRUNED} old backup(s)"

# ── Summary ───────────────────────────────────────────────────

TOTAL_BACKUPS=$(find "${BACKUP_DIR}" \( -name "openfarm_*.dump" -o -name "openfarm_*.sql.gz" \) | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
log "Backup complete. ${TOTAL_BACKUPS} backup(s) on disk (${TOTAL_SIZE} total)"
