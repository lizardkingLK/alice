#!/usr/bin/env bash
set -euo pipefail

# Create a new migration from schema.prisma changes (after baseline 0_init_supabase).
# Usage: ./script_create_migrate.sh <migration_name>
# Example: ./script_create_migrate.sh add_projects_table
#
# Baseline (one-time, already committed as 0_init_supabase) used:
#   prisma migrate diff --from-empty --to-schema prisma/schema.prisma
#   prisma migrate resolve --applied 0_init_supabase

cd "$(dirname "$0")"

if [[ $# -lt 1 ]]; then
  echo "info. usage: $0 <migration_name>"
  exit 1
fi

migration="$1"
migration_dir="prisma/migrations/${migration}"

if [[ -d "$migration_dir" ]]; then
  echo "error. migration directory already exists: ${migration_dir}"
  exit 1
fi

mkdir -p "${migration_dir}"

pnpm exec prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma \
  --script > "${migration_dir}/migration.sql"

if [[ ! -s "${migration_dir}/migration.sql" ]]; then
  echo "info. no schema changes detected. removing empty migration."
  rmdir "${migration_dir}"
  exit 0
fi

echo "info. created ${migration_dir}/migration.sql"
echo "info. review the SQL before continuing."

pnpm exec prisma migrate deploy
bash ./script_generate_types.sh
pnpm run seed

echo "info. migration applied, types regenerated, and seed completed."
