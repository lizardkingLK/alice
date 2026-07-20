# Alice - AWS Infrastructure Setup

This directory contains the automated tools to install dependencies and provision the virtual machine (EC2) hosting the **Alice** web application.

---

## Directory Layout

```text
infra/
├── create_virtual_machine/
│   ├── main.sh          # Orchestration script (Apply / Destroy)
│   └── main.tf          # Terraform configuration file
├── install_aws.sh       # Installs AWS CLI tool natively
└── install.sh           # Installs Terraform tool natively
```

---

## Step-by-Step Deployment Guide

### Step 1: Install Required Tooling

Run both root installation scripts to set up the system binaries inside your environment:

```bash
# Install AWS CLI
chmod +x install_aws.sh && ./install_aws.sh

# Install Terraform
chmod +x install.sh && ./install.sh
```

### Step 2: Acquire AWS IAM Credentials

1. Log into your **AWS Console**.
2. Navigate to **IAM** -> **Users** -> Select your user profile.
3. Click the **Security credentials** tab, scroll to **Access keys**, and click **Create access key**.
4. Select **Command Line Interface (CLI)**, accept the terms, and copy your:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

### Step 3: Launch the Alice VM

Execute the orchestration script with your credentials. This script automatically handles local SSH key generation, security rule updates (opening port 22), and spins up the instance:

```bash
cd create_virtual_machine
chmod +x main.sh

# Usage: ./main.sh apply <ACCESS_KEY> <SECRET_KEY> <REGION>
./main.sh apply "YOUR_ACCESS_KEY" "YOUR_SECRET_KEY" "us-east-1"
```

### Step 4: Access Your Virtual Machine

Once complete, the script outputs your terminal connection string. Run it to connect:

```bash
ssh -i ./my_vm_key ubuntu@<YOUR_VM_PUBLIC_IP>
```

---

## Tearing Down Infrastructure

To wipe out the cloud resources and avoid unexpected AWS billing, run the destroy command:

```bash
# Usage: ./main.sh destroy <ACCESS_KEY> <SECRET_KEY> <REGION>
./main.sh destroy "YOUR_ACCESS_KEY" "YOUR_SECRET_KEY" "us-east-1"
```

---

## Security & Networking Notes

- **Default Security Group:** The configuration fetches and links your default AWS network group.
- **Port 22 Rules:** Port `22` (TCP/SSH) is explicitly managed and opened to allow inbound connections.
- **Key Pair:** The private key asset (`alice_key`) is saved locally. Never check this file into public repositories.
