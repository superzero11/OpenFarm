# Deployment Guide

Deploy OpenFarm on a single VPS using Docker Compose + Caddy (auto-SSL).

This guide uses **Oracle Cloud Free Tier** (always-free ARM VM with 24 GB RAM), but the steps work on any Ubuntu 22.04+ server.

---

## Prerequisites

- A domain name (e.g., `openfarm.example.com`) — free from [Freenom](https://freenom.com) or your registrar
- Google OAuth credentials — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- SSH client on your local machine

---

## Step 1: Create a Free Oracle Cloud VM

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com) (credit card for verification, never charged)
2. Go to **Compute → Instances → Create Instance**
3. Configure:
   - **Image**: Ubuntu 22.04 (or 24.04)
   - **Shape**: Ampere A1 — **4 OCPUs, 24 GB RAM** (free tier max)
   - **Boot volume**: 100 GB
   - **Networking**: assign a public IP, add your SSH key
4. Click **Create**
5. Note the **public IP address** once it's running

### Open Firewall Ports (Oracle Cloud specific)

Oracle Cloud has **two firewalls** — the VCN security list and the OS firewall. You must open both.

#### VCN Security List (Oracle Cloud Console):
1. Go to **Networking → Virtual Cloud Networks → your VCN → Security Lists → Default**
2. Add **Ingress Rules**:
   - Source `0.0.0.0/0`, Protocol TCP, Port **80** (HTTP)
   - Source `0.0.0.0/0`, Protocol TCP, Port **443** (HTTPS)

#### OS Firewall (handled by setup.sh automatically)

---

## Step 2: Provision the Server

SSH into your new VM and run the setup script:

```bash
ssh ubuntu@<your-vm-ip>

# Download and run setup script
curl -sSL https://raw.githubusercontent.com/superzero11/OpenFarm/main/deploy/setup.sh | sudo bash
```

This installs Docker, configures the firewall, creates swap, clones the repo, and generates secure random passwords.

---

## Step 3: Configure Environment

```bash
cd /opt/openfarm
sudo nano .env
```

Update these values (the setup script already generated secure random secrets for everything else):

```bash
# Your domain
DOMAIN=openfarm.example.com
NEXTAUTH_URL=https://openfarm.example.com
NEXT_PUBLIC_API_URL=https://openfarm.example.com/v1
NEXT_PUBLIC_TITILER_URL=https://openfarm.example.com/tiles
NEXT_PUBLIC_PROTOMAPS_URL=https://openfarm.example.com/storage/openfarm/basemap
TITILER_PUBLIC_URL=https://openfarm.example.com/tiles
CORS_ORIGINS=https://openfarm.example.com

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
```

> **Important**: In Google Cloud Console, add `https://openfarm.example.com/api/auth/callback/google` as an authorized redirect URI.

---

## Step 4: Point DNS to Your Server

At your domain registrar, create an **A record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `openfarm` (or `@`) | `<your-vm-ip>` | 300 |

Wait a few minutes for DNS propagation:

```bash
dig openfarm.example.com +short
# Should return your VM's IP
```

---

## Step 5: Deploy

```bash
cd /opt/openfarm

# Build and start all services
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

First build takes 5–10 minutes (downloading images, compiling). Subsequent deploys are faster with Docker layer caching.

---

## Step 6: Verify

```bash
# Check all services are running
sudo docker compose ps

# Check health endpoints
curl -s http://localhost:8000/healthz    # API
curl -s http://localhost:3000/api/health # Web (internal)
curl -s https://openfarm.example.com    # Public (through Caddy)
```

Caddy automatically provisions a Let's Encrypt SSL certificate on first HTTPS request. This may take 30–60 seconds.

---

## Production Architecture

```
Internet
    │
    ▼
  Caddy (:80 → redirect, :443 auto-SSL)
    ├── /v1/*          → api:8000      (FastAPI)
    ├── /docs*         → api:8000      (Swagger UI)
    ├── /healthz       → api:8000      (Health check)
    ├── /tiles/*       → tiler:80      (TiTiler COG tiles)
    ├── /cog/*         → tiler:80      (TiTiler COG endpoints)
    ├── /storage/*     → minio:9000    (Public basemap tiles)
    └── /*             → web:3000      (Next.js frontend)

Internal network (not exposed):
    ├── db:5432        (PostgreSQL + PostGIS)
    ├── redis:6379     (Celery broker + cache)
    ├── minio:9000     (Object storage)
    └── processor      (Celery worker — NDVI pipeline)
```

---

## Maintenance

### View Logs

```bash
cd /opt/openfarm

# All services
sudo docker compose logs -f --tail 100

# Specific service
sudo docker compose logs -f api
sudo docker compose logs -f processor
sudo docker compose logs -f web
```

### Update to Latest Version

```bash
cd /opt/openfarm
git pull origin main
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Database Backup

```bash
# Create backup
sudo docker compose exec db pg_dump -U openfarm openfarm | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore backup
gunzip -c backup_20260215.sql.gz | sudo docker compose exec -T db psql -U openfarm openfarm
```

### Restart a Service

```bash
sudo docker compose restart api
sudo docker compose restart processor
```

### Full Restart

```bash
cd /opt/openfarm
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Monitoring

### Disk Usage

```bash
df -h                                            # Overall disk
sudo docker system df                            # Docker disk usage
sudo du -sh /var/lib/docker/volumes/*            # Per-volume usage
```

### Memory/CPU

```bash
htop                                             # Live system monitor
sudo docker stats --no-stream                    # Per-container resource usage
```

### SSL Certificate

Caddy auto-renews Let's Encrypt certificates. Check status:

```bash
sudo docker compose exec caddy caddy list-certificates
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Caddy shows "connection refused" | Check DNS points to correct IP; wait for propagation |
| SSL certificate not provisioned | Ensure ports 80/443 are open in both Oracle VCN and OS firewall |
| API unhealthy | Check DB is ready: `docker compose logs db` |
| NDVI jobs stuck | Check Celery worker: `docker compose logs processor` |
| Out of disk | Clean old images: `docker system prune -a` |
| Out of memory | Check `docker stats`; reduce Celery concurrency in prod config |
