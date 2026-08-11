# ── OCI account ──────────────────────────────────────────────────────

variable "tenancy_ocid" {
  description = "OCID of your tenancy (OCI Console → Profile → Tenancy)."
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment to create resources in. Empty = tenancy root."
  type        = string
  default     = ""
}

variable "region" {
  description = "OCI region identifier, e.g. ap-mumbai-1, eu-frankfurt-1."
  type        = string
}

variable "oci_config_profile" {
  description = "Profile name in ~/.oci/config."
  type        = string
  default     = "DEFAULT"
}

variable "availability_domain_number" {
  description = "1-based index into the region's availability domains. Change this (1..3) when hitting 'Out of host capacity' errors for A1 instances."
  type        = number
  default     = 1
}

# ── Access ───────────────────────────────────────────────────────────

variable "ssh_public_key" {
  description = "Contents of your SSH public key (e.g. file(\"~/.ssh/id_ed25519.pub\"))."
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to reach SSH (22). Strongly consider <your-ip>/32 instead of the default."
  type        = string
  default     = "0.0.0.0/0"

  validation {
    condition     = can(cidrhost(var.ssh_allowed_cidr, 0))
    error_message = "ssh_allowed_cidr must be a valid CIDR block, e.g. 203.0.113.7/32."
  }
}

# ── Application ──────────────────────────────────────────────────────

variable "domain" {
  description = "Public hostname OpenFarm is served on (bare domain, no scheme, no trailing slash). You must point an A record at the instance IP."
  type        = string

  validation {
    condition     = !can(regex("^https?://", var.domain)) && !endswith(var.domain, "/")
    error_message = "domain must be a bare hostname like openfarm.example.com - no http(s):// prefix, no trailing slash."
  }
}

variable "google_client_id" {
  description = "Google OAuth client ID."
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth client secret."
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend API key for transactional email (optional)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "git_branch" {
  description = "Branch of the OpenFarm repo to deploy."
  type        = string
  default     = "main"
}

# ── Instance shape (Always Free maxima as defaults) ──────────────────

variable "instance_display_name" {
  type    = string
  default = "openfarm"
}

variable "instance_ocpus" {
  type    = number
  default = 2
}

variable "instance_memory_gbs" {
  type    = number
  default = 12
}

variable "boot_volume_gbs" {
  type    = number
  default = 100
}

variable "ubuntu_version" {
  description = "Canonical Ubuntu version for the image lookup."
  type        = string
  default     = "24.04"
}

# ── Network ──────────────────────────────────────────────────────────

variable "vcn_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "subnet_cidr" {
  type    = string
  default = "10.0.0.0/24"
}

# ── Locals ───────────────────────────────────────────────────────────

locals {
  compartment_id = var.compartment_ocid != "" ? var.compartment_ocid : var.tenancy_ocid
  repo_url       = "https://github.com/superzero11/OpenFarm.git"
}
