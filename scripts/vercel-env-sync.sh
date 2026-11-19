#!/usr/bin/env bash
# Upsert Vercel project env vars from prefixed process env (GitHub Secrets).
#
# GitHub secret names are prefixed (API_DATABASE_URL). This script strips the
# prefix and writes unprefixed keys to Vercel (DATABASE_URL), matching app
# runtime and existing Vercel project variables.
#
# Uses the Vercel REST API (not `vercel env add`) so CI does not depend on a
# half-linked `.vercel/` directory before `vercel pull`. That CLI path often
# fails with the misleading "Could not retrieve Project Settings" error.
#
# Usage (CI):
#   export API_DATABASE_URL=...   # from ${{ secrets.API_DATABASE_URL }}
#   ./scripts/vercel-env-sync.sh --app api --environment production
#
# Requires: curl, python3, VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/env-keys.sh
source "${ROOT_DIR}/scripts/lib/env-keys.sh"

APP=""
ENVIRONMENT="production"
SAMPLE_ENV=""
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/vercel-env-sync.sh --app api|web [--environment production] [--sample-env PATH] [--dry-run]

For each basename in the app sample.env allowlist, reads ${PREFIX}_${NAME} from
the environment, skips empty values, and upserts via:
  POST /v10/projects/{id}/env?upsert=true&teamId={orgId}

Requires VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID.
EOF
}

# Map key name → Vercel env type (NEXT_PUBLIC_* stays readable as plain).
env_var_type_for_key() {
  local key="$1"

  case "$key" in
    NEXT_PUBLIC_*) printf '%s' 'plain' ;;
    *) printf '%s' 'encrypted' ;;
  esac
}

# POST one upsert; prints HTTP status on stdout, body on stderr for failures.
upsert_vercel_env() {
  local key="$1"
  local value="$2"
  local target="$3"
  local env_type
  local payload
  local url
  local response_file
  local http_code

  env_type="$(env_var_type_for_key "$key")"
  payload="$(
    KEY="$key" VALUE="$value" TARGET="$target" ENV_TYPE="$env_type" python3 - <<'PY'
import json, os
print(json.dumps({
    "key": os.environ["KEY"],
    "value": os.environ["VALUE"],
    "type": os.environ["ENV_TYPE"],
    "target": [os.environ["TARGET"]],
}))
PY
  )"

  url="https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true&teamId=${VERCEL_ORG_ID}"
  response_file="$(mktemp)"

  http_code="$(
    curl -sS -o "$response_file" -w '%{http_code}' \
      -X POST "$url" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H 'Content-Type: application/json' \
      -d "$payload"
  )"

  if [[ "$http_code" != 200 && "$http_code" != 201 ]]; then
    echo "error. upsert failed for $key (HTTP $http_code)" >&2
    cat "$response_file" >&2 || true
    rm -f "$response_file"
    return 1
  fi

  rm -f "$response_file"
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP="${2:-}"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --sample-env)
      SAMPLE_ENV="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "error. unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$APP" ]]; then
  echo "error. --app api|web is required" >&2
  usage >&2
  exit 1
fi

case "$APP" in
  api)
    PREFIX="API_"
    DEFAULT_SAMPLE="${ROOT_DIR}/apps/api/sample.env"
    ;;
  web)
    PREFIX="WEB_"
    DEFAULT_SAMPLE="${ROOT_DIR}/apps/web/sample.env"
    ;;
  *)
    echo "error. unsupported --app '$APP' (use api or web; worker later)" >&2
    exit 1
    ;;
esac

if [[ -z "$SAMPLE_ENV" ]]; then
  SAMPLE_ENV="$DEFAULT_SAMPLE"
fi

if [[ ! -f "$SAMPLE_ENV" ]]; then
  echo "error. sample env not found: $SAMPLE_ENV" >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "error. VERCEL_TOKEN is required" >&2
    exit 1
  fi

  if [[ -z "${VERCEL_ORG_ID:-}" ]]; then
    echo "error. VERCEL_ORG_ID is required" >&2
    exit 1
  fi

  if [[ -z "${VERCEL_PROJECT_ID:-}" ]]; then
    echo "error. VERCEL_PROJECT_ID is required" >&2
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "error. curl is required" >&2
    exit 1
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "error. python3 is required to JSON-encode env values" >&2
    exit 1
  fi
fi

upserted=0
skipped=0

while IFS= read -r name || [[ -n "$name" ]]; do
  [[ -z "$name" ]] && continue

  env_var="${PREFIX}${name}"
  value="$(printenv "$env_var" || true)"

  if [[ -z "$value" ]]; then
    echo "info. skip empty $env_var (leave existing Vercel $name untouched)"
    skipped=$((skipped + 1))
    continue
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "info. dry-run would upsert $name from $env_var"
    upserted=$((upserted + 1))
    continue
  fi

  upsert_vercel_env "$name" "$value" "$ENVIRONMENT"
  echo "info. upserted $name"
  upserted=$((upserted + 1))
done < <(env_list_keys "$APP" "$SAMPLE_ENV")

echo "info. done. upserted=$upserted skipped=$skipped app=$APP environment=$ENVIRONMENT"
