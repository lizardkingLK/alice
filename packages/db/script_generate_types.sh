#!/usr/bin/env bash
set -euo pipefail

# Regenerates Supabase client types into @repo/types (overwrites the file).
# Requires packages/db/.env with DIRECT_URL set to the non-pooled Postgres URL.

cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "error. DIRECT_URL is not set. Copy sample.env to .env and fill in values."
  exit 1
fi

pnpm exec tsx src/env.ts

output="../types/src/generated/supabase/database.types.ts"
mkdir -p "$(dirname "$output")"

pnpm exec supabase gen types typescript \
  --db-url "${DIRECT_URL}" \
  --schema public \
  > "${output}"

echo "info. wrote ${output}"
