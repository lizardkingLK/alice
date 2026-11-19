#!/usr/bin/env bash
# Push local app env values to GitHub Actions secrets with an app prefix.
#
# Local / Vercel keys stay unprefixed (DATABASE_URL). GitHub secret names are
# prefixed (API_DATABASE_URL) so api / web / future worker can share one repo.
#
# Usage:
#   ./scripts/gh-secrets-push.sh --app api
#   ./scripts/gh-secrets-push.sh --app web
#   ./scripts/gh-secrets-push.sh --app api --env-file /path/to/prod.env
#   ./scripts/gh-secrets-push.sh --app api --dry-run
#
# Defaults to apps/<app>/.env.production (gitignored) — NOT local .env /
# .env.local, which usually have localhost URLs. Fill production values first
# (copy from sample.env, or export from the Vercel project UI / vercel env pull).
#
# Requires: gh (authenticated with repo admin / secrets:write).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/env-keys.sh
source "${ROOT_DIR}/scripts/lib/env-keys.sh"

APP=""
ENV_FILE=""
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/gh-secrets-push.sh --app api|web [--env-file PATH] [--dry-run]

Reads unprefixed KEY=VALUE pairs from a production env file and upserts GitHub
secrets named {PREFIX}_{KEY} (API_ or WEB_). Default file is
apps/<app>/.env.production (not local .env). Skips empty values and sample.env
placeholders (YOUR_* / your-*).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
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
    DEFAULT_ENV_FILE="${ROOT_DIR}/apps/api/.env.production"
    SAMPLE_ENV_FILE="${ROOT_DIR}/apps/api/sample.env"
    ;;
  web)
    PREFIX="WEB_"
    DEFAULT_ENV_FILE="${ROOT_DIR}/apps/web/.env.production"
    SAMPLE_ENV_FILE="${ROOT_DIR}/apps/web/sample.env"
    ;;
  *)
    echo "error. unsupported --app '$APP' (use api or web; worker later)" >&2
    exit 1
    ;;
esac

if [[ -z "$ENV_FILE" ]]; then
  ENV_FILE="$DEFAULT_ENV_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error. production env file not found: $ENV_FILE" >&2
  echo "info. do not use local .env — prod domains/URLs differ" >&2
  echo "info. create it from the template, then fill real production values:" >&2
  echo "info.   cp ${SAMPLE_ENV_FILE} ${DEFAULT_ENV_FILE}" >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "error. GitHub CLI (gh) is not installed. Rebuild the devcontainer (github-cli feature) or install gh." >&2
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "error. gh is not authenticated. Run: gh auth login" >&2
    exit 1
  fi
fi

pushed=0
skipped=0

while IFS=$'\t' read -r key value; do
  [[ -z "$key" ]] && continue

  if [[ -z "$value" ]]; then
    echo "info. skip empty $key"
    skipped=$((skipped + 1))
    continue
  fi

  if env_value_is_placeholder "$value"; then
    echo "info. skip placeholder $key"
    skipped=$((skipped + 1))
    continue
  fi

  secret_name="${PREFIX}${key}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "info. dry-run would set $secret_name"
    pushed=$((pushed + 1))
    continue
  fi

  printf '%s' "$value" | gh secret set "$secret_name"
  echo "info. set $secret_name"
  pushed=$((pushed + 1))
done < <(env_list_pairs "$APP" "$ENV_FILE")

echo "info. done. set=$pushed skipped=$skipped file=$ENV_FILE prefix=$PREFIX"
