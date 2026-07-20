#!/bin/bash

# Exit immediately if any command fails
set -e 

echo "info. fixing directory permissions..."
sudo chown -R node:node /home/node/.local

echo "info. configuring PNPM paths..."
if ! grep -q 'export PATH="$HOME/.local/share/pnpm:$PATH"' ~/.bashrc; then
    echo 'export PATH="$HOME/.local/share/pnpm:$PATH"' >> ~/.bashrc
fi

# Export to current execution context
export PATH="$HOME/.local/share/pnpm:$PATH"
pnpm config set global-bin-dir /home/node/.local/share/pnpm

echo "info. updating PNPM to latest..."
npm install -g pnpm@latest --ignore-scripts

echo "info. installing workspace dependencies..."
pnpm install --ignore-scripts

echo "info. setup complete."
