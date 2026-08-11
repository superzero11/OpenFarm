# OpenFarm on Oracle Cloud — Terraform

Provisions the complete OpenFarm stack on an Oracle Cloud **Always Free** ARM VM
(Ampere A1 Flex, 2 OCPU / 12 GB / 100 GB) with one `terraform apply`:

- VCN, public subnet, internet gateway, security list (22 / 80 / 443)
- Ubuntu 24.04 aarch64 instance
- First-boot cloud-init: runs `deploy/setup.sh` (Docker, swap, ufw + OCI
  iptables fix, fail2ban, secret generation), writes your domain + OAuth
  config into `/opt/openfarm/.env`, builds and starts the full Docker
  Compose stack, and installs a daily backup cron

Only two things remain manual, because they can't be automated from here:
adding the DNS A record at your registrar, and adding the OAuth redirect
URI in Google Cloud Console.

## Prerequisites (one-time)

1. **Terraform** (macOS):

   ```bash
   brew install terraform
   ```

2. **OCI API key** — lets Terraform act as you (no OCI CLI needed):
   - OCI Console → profile avatar (top right) → **My profile** → **API keys**
     → **Add API key** → **Generate API key pair**
   - Download the private key to `~/.oci/oci_api_key.pem` and
     `chmod 600 ~/.oci/oci_api_key.pem`
   - The console shows a config snippet — paste it into `~/.oci/config`
     under `[DEFAULT]`, and set `key_file=~/.oci/oci_api_key.pem`

3. **SSH key** — `ssh-keygen -t ed25519` if you don't have one.

4. **Google OAuth client** and a **domain** you control.

## Usage

```bash
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
# fill in terraform.tfvars (gitignored — holds your OAuth secret)
terraform init
terraform plan
terraform apply
```

Apply takes ~2 minutes; the VM then provisions itself for **15–25 minutes**
(apt, Docker install, ARM image builds). The `next_steps` output walks you
through the rest:

1. Add the A record (`domain → instance_public_ip`) immediately.
2. Add `https://<domain>/api/auth/callback/google` to the OAuth client's
   authorized redirect URIs.
3. `ssh ubuntu@<ip> 'cloud-init status --wait'` blocks until first boot
   finishes (progress: `tail -f /var/log/openfarm-bootstrap.log`).
4. Visit `https://<domain>` — the first request after DNS resolves triggers
   Let's Encrypt issuance (~30–60 s).

## "Out of host capacity"

Always-free A1 capacity is scarce in popular regions. If apply fails with
`Out of host capacity`:

- change `availability_domain_number` (1..3, per region) and re-apply;
- retry at off-peak hours (capacity frees up in waves);
- or upgrade the tenancy to Pay-As-You-Go — always-free resources stay
  free, but you get access to much larger capacity pools.

Apply fails cleanly and is safe to re-run; the network resources that
already succeeded are reused.

## Day-2 operations

- **App updates**: SSH in, `cd /opt/openfarm && git pull && docker compose
  -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
  Do **not** re-apply Terraform for app changes — the instance ignores
  `user_data` changes after first boot (guarded with `ignore_changes` so a
  tfvars tweak can't plan a destroy/recreate of your data).
- **Config changes** (domain, OAuth): edit `/opt/openfarm/.env` on the VM,
  then rebuild (`NEXT_PUBLIC_*` are build args — a domain change requires
  `up -d --build`, not just a restart).
- **Backups**: cron runs `deploy/backup.sh` daily at 02:00 (log:
  `/var/log/openfarm-backup.log`). Copy dumps off the VM regularly.
- **Replace the VM deliberately**: `terraform taint oci_core_instance.openfarm
  && terraform apply` — this **destroys pgdata/miniodata**; back up first.
- **Destroy everything**: `terraform destroy` — same warning: all data dies
  with the boot volume. Note: repeated destroy/recreate under the same
  domain can hit Let's Encrypt duplicate-certificate rate limits
  (5 per week).

## State & secrets

- Terraform state is **local** (`terraform.tfstate`, gitignored). It
  contains `google_client_secret` and the rendered cloud-init in plaintext:
  keep it out of git, consider `chmod 600`, and back it up privately.
  If more than one person ever manages this infra, migrate to a remote
  backend (OCI Object Storage has an S3-compatible mode).
- Runtime secrets (DB password, JWT secret, NextAuth secret, MinIO
  password) are generated **on the VM** by `setup.sh` and live only in
  `/opt/openfarm/.env` — they never touch Terraform state. That file plus
  the backup dumps are what you need to save to survive a VM loss.

## Known caveats

- MinIO presigned upload URLs pass through Caddy's `/storage` prefix strip;
  verify photo uploads work after deploy (path-style S3 signatures are
  sensitive to prefix rewriting).
- `ssh_allowed_cidr` defaults to open; set it to `<your-ip>/32`. If your IP
  changes and you're locked out, edit the security list rule in the OCI
  console (VCN → Security Lists → openfarm-sl).
