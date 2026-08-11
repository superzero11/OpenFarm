output "instance_public_ip" {
  description = "Public IP of the OpenFarm VM - point your domain's A record here."
  value       = oci_core_instance.openfarm.public_ip
}

output "ssh_command" {
  value = "ssh ubuntu@${oci_core_instance.openfarm.public_ip}"
}

output "next_steps" {
  value = <<-EOT

    ┌─────────────────────────────────────────────────────────────────┐
    │ OpenFarm is provisioning (first boot takes ~15-25 minutes).     │
    └─────────────────────────────────────────────────────────────────┘

    1. NOW: add a DNS A record at your registrar:
         ${var.domain}  →  ${oci_core_instance.openfarm.public_ip}   (TTL 300)

    2. In Google Cloud Console → Credentials → your OAuth client,
       add authorized redirect URI:
         https://${var.domain}/api/auth/callback/google

    3. Wait for provisioning to finish:
         ssh ubuntu@${oci_core_instance.openfarm.public_ip} 'cloud-init status --wait'
       (progress: ssh in and: tail -f /var/log/openfarm-bootstrap.log)

    4. Verify:
         curl -s https://${var.domain}/healthz
       First HTTPS visit triggers Let's Encrypt issuance (~30-60 s after
       DNS resolves).

  EOT
}
