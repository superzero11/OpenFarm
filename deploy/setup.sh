#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenFarm — Server Setup Script
#
# Provisions a fresh Ubuntu 22.04+ server (AMD64 or ARM64) for OpenFarm.
# Run as root or with sudo on the target server.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/superzero11/OpenFarm/main/deploy/setup.sh | bash
#   # or
#   sudo bash deploy/setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_URL="https://github.com/superzero11/OpenFarm.git"
REPO_BRANCH="${REPO_BRANCH:-main}"
INSTALL_DIR="/opt/openfarm"

echo "──────────────────────────────────────────────────────────"
echo " OpenFarm — Server Setup"
echo "──────────────────────────────────────────────────────────"

# ── 0. Wait for apt locks ────────────────────────────────────────────
# On first boot (cloud-init), unattended-upgrades often holds the apt
# lock for several minutes; racing it kills the script under set -e.
wait_for_apt() {
    local waited=0
    while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock >/dev/null 2>&1; do
        if [ "$waited" -ge 600 ]; then
            echo "✗ apt lock still held after 10 min, giving up" >&2
            return 1
        fi
        echo "▸ Waiting for apt lock (held by another process)..."
        sleep 10
        waited=$((waited + 10))
    done
}
wait_for_apt

# ── 1. System updates ────────────────────────────────────────────────
echo "▸ Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "▸ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "▸ Docker already installed"
fi

# Ensure Docker Compose plugin is available
if ! docker compose version &>/dev/null; then
    echo "▸ Installing Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
fi

# ── 3. Install useful tools ─────────────────────────────────────────
echo "▸ Installing utilities..."
apt-get install -y -qq git curl htop nano ufw fail2ban

# ── 4. Create swap (if not present) ─────────────────────────────────
if [ ! -f /swapfile ]; then
    echo "▸ Creating 4GB swap file..."
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Optimize swap usage
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
    echo "▸ Swap already configured"
fi

# ── 5. Configure firewall ───────────────────────────────────────────
echo "▸ Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Oracle Cloud Ubuntu images ship netfilter-persistent rules ending in a
# blanket REJECT that ufw does not override — insert explicit ACCEPTs.
if [ -f /etc/iptables/rules.v4 ]; then
    echo "▸ Opening 80/443 in OCI iptables rules..."
    for p in 80 443; do
        iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || \
            iptables -I INPUT -p tcp --dport "$p" -j ACCEPT
    done
    iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || \
        iptables -I INPUT -p udp --dport 443 -j ACCEPT
    netfilter-persistent save
fi

# ── 6. Configure fail2ban ───────────────────────────────────────────
echo "▸ Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# ── 7. Clone repository ─────────────────────────────────────────────
if [ ! -d "$INSTALL_DIR" ]; then
    echo "▸ Cloning OpenFarm ($REPO_BRANCH) to $INSTALL_DIR..."
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
else
    echo "▸ OpenFarm already cloned, pulling latest..."
    cd "$INSTALL_DIR" && git pull origin "$REPO_BRANCH"
fi

cd "$INSTALL_DIR"

# ── 8. Create .env from template ────────────────────────────────────
if [ ! -f .env ]; then
    echo "▸ Creating .env from template..."
    cp .env.example .env

    # Generate random secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    MINIO_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

    # Apply generated secrets
    sed -i "s|POSTGRES_PASSWORD=openfarm_dev|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
    sed -i "s|openfarm:openfarm_dev@|openfarm:$POSTGRES_PASSWORD@|g" .env
    sed -i "s|MINIO_ROOT_PASSWORD=openfarm_dev_secret|MINIO_ROOT_PASSWORD=$MINIO_PASSWORD|" .env
    sed -i "s|MINIO_SECRET_KEY=openfarm_dev_secret|MINIO_SECRET_KEY=$MINIO_PASSWORD|" .env
    sed -i "s|NEXTAUTH_SECRET=change-me-to-a-random-32-char-string|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" .env
    sed -i "s|OPENFARM_JWT_SECRET=change-me-to-a-random-64-char-string|OPENFARM_JWT_SECRET=$JWT_SECRET|" .env

    echo ""
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║  .env created with random secrets.                   ║"
    echo "  ║                                                      ║"
    echo "  ║  You still need to configure:                        ║"
    echo "  ║    1. GOOGLE_CLIENT_ID                               ║"
    echo "  ║    2. GOOGLE_CLIENT_SECRET                           ║"
    echo "  ║    3. DOMAIN (in .env — for Caddy SSL)               ║"
    echo "  ║    4. NEXTAUTH_URL (https://your-domain.com)         ║"
    echo "  ║    5. NEXT_PUBLIC_API_URL (https://your-domain.com/v1)║"
    echo "  ║    6. CORS_ORIGINS (https://your-domain.com)         ║"
    echo "  ║                                                      ║"
    echo "  ║  Edit with: nano $INSTALL_DIR/.env                   ║"
    echo "  ╚══════════════════════════════════════════════════════╝"
    echo ""
else
    echo "▸ .env already exists, skipping"
fi

# ── 9. Summary ───────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────"
echo " ✅ Server setup complete!"
echo ""
echo " Next steps:"
echo "   1. Edit .env:     nano $INSTALL_DIR/.env"
echo "   2. Set your domain and Google OAuth credentials"
echo "   3. Start the stack:"
echo "      cd $INSTALL_DIR"
echo "      docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo ""
echo "   4. Verify:"
echo "      docker compose ps"
echo "      curl -s http://localhost:8000/healthz"
echo "──────────────────────────────────────────────────────────"
