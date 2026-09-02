#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

copy_app_secrets() {
    local app_dir="$1"
    local dest="$2"
    local label="$3"
    local source=""

    if [ -f "${app_dir}/.env.local" ]; then
        source="${app_dir}/.env.local"
    elif [ -f "${app_dir}/.env" ]; then
        source="${app_dir}/.env"
    else
        echo "error. no env file for ${label} (expected ${app_dir}/.env.local or ${app_dir}/.env)" >&2
        exit 1
    fi

    cp "$source" "$dest"
    echo "info. copied ${label} secrets from ${source} → ${dest}"
}

echo "info. starting docker deployment"

echo "info. copying secrets for web and api projects..."
copy_app_secrets "apps/web" "./secrets_web.txt" "web"
copy_app_secrets "apps/api" "./secrets_api.txt" "api"

if [ -f ./secrets_web.txt ]; then
    echo "info. injecting environment tokens for local compilation..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' ./secrets_web.txt | xargs)
fi

echo "info. installing workspace dependencies..."
pnpm install --frozen-lockfile --ignore-scripts

echo "info. compiling turborepo apps..."
NODE_ENV=production pnpm turbo run build

echo "info. packaging and deploying docker containers..."
export INTERNAL_API_URL="http://api:5000"
INTERNAL_API_URL=$INTERNAL_API_URL docker compose up --build

echo "info. cleaning up old dangling docker images and build caches..."
docker image prune -f
docker builder prune -f --filter type=exec

echo "info. deployment complete..."