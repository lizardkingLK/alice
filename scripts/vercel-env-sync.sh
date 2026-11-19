#!/usr/bin/env bash
# Upsert Vercel project env vars from prefixed process env (GitHub Secrets).
#
# GitHub secret names are prefixed (API_DATABASE_URL). This script strips the
# prefix and writes unprefixed keys to Vercel (DATABASE_URL), matching app
# runtime and existing Vercel project variables.
#
# Usage (CI):
#   export API_DATABASE_URL=...   # from ${{ secrets.API_DATABASE_URL }}
#   ./scripts/vercel-env-sync.sh --app api --environment production
#
# Requires: vercel CLI, VERCEL_TOKEN, linked project (.vercel/project.json).

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
the environment, skips empty values, and runs:
  vercel env add NAME <environment> --yes --force
EOF
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
  if ! command -v vercel >/dev/null 2>&1; then
    echo "error. vercel CLI is not installed" >&2
    exit 1
  fi

  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "error. VERCEL_TOKEN is required" >&2
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

  printf '%s' "$value" | vercel env add "$name" "$ENVIRONMENT" \
    --token "$VERCEL_TOKEN" \
    --yes \
    --force
  echo "info. upserted $name"
  upserted=$((upserted + 1))
done < <(env_list_keys "$APP" "$SAMPLE_ENV")

echo "info. done. upserted=$upserted skipped=$skipped app=$APP environment=$ENVIRONMENT"
