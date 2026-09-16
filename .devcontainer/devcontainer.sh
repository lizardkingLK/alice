#!/bin/bash

# Exit immediately if any command fails
set -e 

echo "info. fixing directory permissions..."
sudo chown -R node:node /home/node/.local

echo "info. configuring PNPM paths..."
# Explicitly set up home directory path for native pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
if ! grep -q 'export PNPM_HOME' ~/.bashrc; then
    echo "export PNPM_HOME=\"$PNPM_HOME\"" >> ~/.bashrc
    echo 'export PATH="$PNPM_HOME:$PATH"' >> ~/.bashrc
fi

# Export to current script execution context
export PATH="$PNPM_HOME:$PATH"

echo "info. installing native pnpm 12 binary..."
# FIX: Define the version constraint in the current shell first, 
# then pipe clean bash code safely without 'env' keywords breaking the stream.
export PNPM_VERSION="12.4.2"
curl -fsSL --proto '=https' https://pnpm.io | sh -

echo "info. installing workspace dependencies..."
# Running with standard installation hooks
pnpm install --ignore-scripts

echo "info. setup complete."
