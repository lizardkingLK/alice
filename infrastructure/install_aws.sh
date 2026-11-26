#!/usr/bin/env bash
# Deprecated: worker host IaC moved from AWS to OCI Ampere Always Free.
# Kept so old links do not break; use ../install.sh for Terraform and
# create_virtual_machine/main.sh for OCI apply/destroy.
set -euo pipefail

echo "warn. install_aws.sh is deprecated — Alice worker IaC targets OCI, not AWS"
echo "info. install Terraform with: $(dirname "$0")/install.sh"
exit 1
