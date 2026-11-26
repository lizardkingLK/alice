terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 9.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

variable "tenancy_ocid" {
  type        = string
  description = "OCI tenancy OCID"
}

variable "user_ocid" {
  type        = string
  description = "OCI user OCID for the API key"
}

variable "fingerprint" {
  type        = string
  description = "API key fingerprint"
}

variable "private_key_path" {
  type        = string
  description = "Path to the OCI API private key PEM"
}

variable "region" {
  type        = string
  description = "Home region (Always Free compute must be here)"
}

variable "compartment_ocid" {
  type        = string
  description = "Compartment OCID for the worker VM (often the tenancy root)"
}

variable "ssh_public_key_path" {
  type        = string
  default     = "./alice_key.pub"
  description = "SSH public key installed on the instance"
}

variable "display_name" {
  type    = string
  default = "alice-worker"
}

variable "instance_ocpus" {
  type        = number
  default     = 2
  description = "Always Free A1 budget is 2 OCPUs total per tenancy"
}

variable "instance_memory_in_gbs" {
  type        = number
  default     = 12
  description = "Always Free A1 budget is 12 GB memory total per tenancy"
}

variable "boot_volume_size_in_gbs" {
  type    = number
  default = 50
}

data "oci_identity_availability_domain" "ad" {
  compartment_id = var.tenancy_ocid
  ad_number      = 1
}

data "oci_core_images" "ubuntu_aarch64" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_vcn" "worker" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "${var.display_name}-vcn"
  dns_label      = "aliceworker"
}

resource "oci_core_internet_gateway" "worker" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.worker.id
  display_name   = "${var.display_name}-igw"
  enabled        = true
}

resource "oci_core_route_table" "worker" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.worker.id
  display_name   = "${var.display_name}-rt"

  route_rules {
    network_entity_id = oci_core_internet_gateway.worker.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}

resource "oci_core_security_list" "worker" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.worker.id
  display_name   = "${var.display_name}-sl"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  # SSH — tighten cidr_blocks to your IP when possible.
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 22
      max = 22
    }
  }
}

resource "oci_core_subnet" "worker" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.worker.id
  cidr_block                 = "10.0.1.0/24"
  display_name               = "${var.display_name}-subnet"
  dns_label                  = "worker"
  route_table_id             = oci_core_route_table.worker.id
  security_list_ids          = [oci_core_security_list.worker.id]
  prohibit_public_ip_on_vnic = false
}

resource "oci_core_instance" "worker" {
  availability_domain = data.oci_identity_availability_domain.ad.name
  compartment_id      = var.compartment_ocid
  display_name        = var.display_name
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_in_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.worker.id
    assign_public_ip = true
    display_name     = "${var.display_name}-vnic"
    hostname_label   = "aliceworker"
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_aarch64.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_in_gbs
  }

  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
  }
}

check "always_free_a1_budget" {
  assert {
    condition = (
      oci_core_instance.worker.shape_config[0].ocpus <= 2 &&
      oci_core_instance.worker.shape_config[0].memory_in_gbs <= 12
    )
    error_message = "A1 shape exceeds Always Free budget (2 OCPU / 12 GB)."
  }
}

output "instance_id" {
  value = oci_core_instance.worker.id
}

output "public_ip" {
  value = oci_core_instance.worker.public_ip
}

output "ssh_connection_command" {
  description = "SSH as ubuntu (Canonical image). Replace the key path if needed."
  value       = "ssh -i ./alice_key ubuntu@${oci_core_instance.worker.public_ip}"
}
