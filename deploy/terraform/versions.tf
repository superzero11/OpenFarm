terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

# Auth comes from ~/.oci/config (API key). No credentials in HCL or tfvars.
provider "oci" {
  config_file_profile = var.oci_config_profile
  region              = var.region
}
