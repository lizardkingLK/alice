#!/bin/bash

# Exit immediately if any command fails
set -e 

echo "info. fixing directory permissions..."
mkdir -p /home/node/.local /home/node/.cursor
sudo chown -R node:node /home/node/.local /home/node/.cursor

echo "info. configuring PNPM paths..."
export PNPM_HOME="$HOME/.local/share/pnpm"

if ! grep -q 'export PNPM_HOME' ~/.bashrc; then
    echo "export PNPM_HOME=\"$PNPM_HOME\"" >> ~/.bashrc
    echo 'export PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"' >> ~/.bashrc
fi

# Export to current script execution context
export PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"

echo "info. installing native pnpm 12 binary..."
export PNPM_VERSION="12.15.0"
curl -fsSL --proto '=https' https://get.pnpm.io | sh -

echo "info. installing workspace dependencies..."
pnpm install --ignore-scripts

# Install Cursor CLI if not already present
if ! command -v agent &> /dev/null && ! command -v cursor &> /dev/null; then
    echo "Installing Cursor CLI..."
    curl https://cursor.com/install -fsS | bash
fi

# Ensure ~/.local/bin is on PATH for future terminal sessions
if ! grep -q 'HOME/.local/bin' ~/.bashrc; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi

if ! command -v gh >/dev/null 2>&1; then
    echo "error. GitHub CLI (gh) is missing. Rebuild the devcontainer so the github-cli feature installs (see .devcontainer/devcontainer.json)." >&2
    exit 1
fi

echo "info. GitHub CLI available: $(gh --version | head -n 1)"
echo "info. setup complete."
