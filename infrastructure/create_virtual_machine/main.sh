#!/usr/bin/env bash
set -euo pipefail

# Provision / destroy the Alice worker host on OCI Ampere A1 (Always Free).
# Requires: terraform (see ../install.sh), OCI API key, and tenancy OCIDs.
#
# Usage:
#   ./main.sh apply
#   ./main.sh destroy
#
# Credentials (export before running, or place in the environment):
#   TF_VAR_tenancy_ocid
#   TF_VAR_user_ocid
#   TF_VAR_fingerprint
#   TF_VAR_private_key_path   # absolute or relative path to API PEM
#   TF_VAR_region             # home region, e.g. ap-sydney-1
#   TF_VAR_compartment_ocid

KEY_NAME="alice_key"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

print_usage() {
  echo "warn. usage:"
  echo "  $0 apply"
  echo "  $0 destroy"
  echo ""
  echo "warn. required env:"
  echo "  TF_VAR_tenancy_ocid TF_VAR_user_ocid TF_VAR_fingerprint"
  echo "  TF_VAR_private_key_path TF_VAR_region TF_VAR_compartment_ocid"
  exit 1
}

require_env() {
  local missing=0
  for name in \
    TF_VAR_tenancy_ocid \
    TF_VAR_user_ocid \
    TF_VAR_fingerprint \
    TF_VAR_private_key_path \
    TF_VAR_region \
    TF_VAR_compartment_ocid
  do
    if [[ -z "${!name:-}" ]]; then
      echo "error. missing ${name}"
      missing=1
    fi
  done
  if [[ "${missing}" -ne 0 ]]; then
    print_usage
  fi
}

if [[ $# -ne 1 ]]; then
  print_usage
fi

ACTION="$1"
require_env

export TF_VAR_ssh_public_key_path="${TF_VAR_ssh_public_key_path:-./${KEY_NAME}.pub}"

if [[ "${ACTION}" == "destroy" ]]; then
  echo "info. initializing Terraform..."
  terraform init -upgrade
  echo "info. destroying OCI worker infrastructure..."
  terraform destroy -auto-approve
  echo "info. infrastructure removed successfully"
  exit 0
fi

if [[ "${ACTION}" != "apply" ]]; then
  echo "error. invalid action '${ACTION}'"
  print_usage
fi

if [[ ! -f "./${KEY_NAME}" ]]; then
  echo "info. generating SSH key pair..."
  ssh-keygen -t ed25519 -f "./${KEY_NAME}" -N ""
  chmod 400 "./${KEY_NAME}"
  echo "info. keys created: ./${KEY_NAME} and ./${KEY_NAME}.pub"
else
  echo "info. SSH key already exists. skipping generation"
fi

echo "info. initializing Terraform (oracle/oci ~> 9.x)..."
terraform init -upgrade

echo "info. applying infrastructure changes (VM.Standard.A1.Flex)..."
terraform apply -auto-approve

echo "--------------------------------------------------------"
echo "info. deployment complete"
echo "info. SSH key (this directory): ./${KEY_NAME}"
terraform output -raw ssh_connection_command
echo ""
echo "--------------------------------------------------------"
