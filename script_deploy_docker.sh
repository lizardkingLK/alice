#!/bin/bash
set -e

echo "info. starting docker deployment"
if [ -f ./secrets_web.txt ]; then
    echo "info. injecting environment tokens for local compilation..."
    export $(grep -v '^#' ./secrets_web.txt | xargs)
fi

echo "info. installing workspace dependencies..."
pnpm install --frozen-lockfile

echo "info. compiling turborepo apps..."
NODE_ENV=production pnpm turbo run build

echo "info. packaging and deploying docker containers..."
export INTERNAL_API_URL="http://api:5000"
INTERNAL_API_URL=$INTERNAL_API_URL docker compose up --build

echo "info. cleaning up old dangling docker images and build caches..."
docker image prune -f
docker builder prune -f --filter type=exec

echo "info. deployment complete..."