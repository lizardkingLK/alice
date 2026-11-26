# Infrastructure (OCI worker host)

Terraform **HCL** + bash wrappers sketch the Phase 6 `apps/worker` VM on
**Oracle Cloud Always Free** Ampere (`VM.Standard.A1.Flex`, default **2 OCPU /
12 GB**) when regional capacity exists.

**Ops note:** If A1 Always Free is out of pool (seen in Singapore), provision an
**AMD** (or other) shape in the Console instead. That host may not be Always
Free–badged; SSH + systemd still apply. The Console VM is not in Terraform
state until imported.

This replaced the earlier AWS `t2.micro` sketch under the same folder.

## Layout

| Path                             | Role                                            |
| -------------------------------- | ----------------------------------------------- |
| `install.sh`                     | Install Terraform on Debian/Ubuntu              |
| `create_virtual_machine/main.tf` | OCI provider `~> 9.0`, VCN, subnet, A1 instance |
| `create_virtual_machine/main.sh` | `apply` / `destroy` + SSH key helper            |

## Prerequisites

1. OCI tenancy. For this A1 stack: Always Free Ampere capacity in the **home
   region**. If the pool is empty, use Console AMD/other and skip `apply` here.
2. API key for a user with permission to manage compute/VCN in the compartment.
3. Terraform ≥ 1.5 (`./install.sh`).

## Apply

```bash
cd infrastructure/create_virtual_machine

export TF_VAR_tenancy_ocid="ocid1.tenancy.oc1.."
export TF_VAR_user_ocid="ocid1.user.oc1.."
export TF_VAR_fingerprint="aa:bb:..."
export TF_VAR_private_key_path="$HOME/.oci/oci_api_key.pem"
export TF_VAR_region="ap-sydney-1"   # your home region
export TF_VAR_compartment_ocid="ocid1.compartment.oc1.."  # or tenancy OCID

chmod +x ./main.sh
./main.sh apply
```

SSH with the printed command (key `./alice_key`).

## Destroy

```bash
./main.sh destroy
```

## Notes

- Keep `instance_ocpus` ≤ 2 and `instance_memory_in_gbs` ≤ 12 for Always Free.
- Prefer tightening the security list SSH `source` CIDR to your IP.
- A VM you already created in the Console is **not** managed by this stack
  until you `terraform import` it (or destroy the console VM and `apply` here).
  Always Free A1 budget is shared — don’t run two full 2/12 instances.
- App runtime (Node, systemd, env) is a separate **runbook** step after the VM
  exists — see Phase 6 in `docs/features/projects/GITHUB_INTEGRATION.md`.
