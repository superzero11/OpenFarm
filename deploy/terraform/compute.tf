data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

locals {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_number - 1].name
}

# Newest Canonical Ubuntu aarch64 image compatible with A1.Flex.
data "oci_core_images" "ubuntu_arm" {
  compartment_id           = local.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = var.ubuntu_version
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"

  filter {
    name   = "display_name"
    values = ["^Canonical-Ubuntu-.*-aarch64-.*$"]
    regex  = true
  }
}

resource "oci_core_instance" "openfarm" {
  compartment_id      = local.compartment_id
  availability_domain = local.availability_domain
  display_name        = var.instance_display_name
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gbs
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.openfarm.id
    assign_public_ip = true
    hostname_label   = "openfarm"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
      domain               = var.domain
      google_client_id     = var.google_client_id
      google_client_secret = var.google_client_secret
      resend_api_key       = var.resend_api_key
      git_branch           = var.git_branch
      repo_url             = local.repo_url
    }))
  }

  preserve_boot_volume = false

  # Changing tfvars or a newer Ubuntu image must not silently plan a
  # destroy/recreate of a VM holding pgdata/miniodata. Post-boot config
  # changes are made on the VM (.env + rebuild); replace deliberately
  # with: terraform taint oci_core_instance.openfarm
  lifecycle {
    ignore_changes = [metadata, source_details]
  }
}
