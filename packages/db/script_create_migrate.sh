#!/usr/bin/env bash
set -euo pipefail

# Create a new migration from schema.prisma changes (after baseline 0_init_supabase).
# Diffs live DB (DIRECT_URL) -> schema.prisma — no shadow database required.
#
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
  if [[ ! -f "${migration_dir}/migration.sql" ]]; then
    echo "info. removing incomplete migration directory: ${migration_dir}"
    rmdir "${migration_dir}"
  else
    echo "error. migration directory already exists: ${migration_dir}" >&2
    exit 1
  fi
fi

# Diff BEFORE creating the migration folder — Prisma scans all subdirs under migrations/.
pnpm exec prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > /tmp/prisma_migration_diff.sql

if [[ ! -s /tmp/prisma_migration_diff.sql ]]; then
  echo "info. no schema changes detected. nothing to migrate."
  exit 0
fi

mkdir -p "${migration_dir}"
cat /tmp/prisma_migration_diff.sql prisma/sql/supabase_grants.sql > "${migration_dir}/migration.sql"

echo "info. created ${migration_dir}/migration.sql"
echo "info. review the SQL before continuing."

# pause and wait press enter to continue

pnpm exec prisma migrate deploy
bash ./script_generate_types.sh
pnpm run seed

echo "info. migration applied, types regenerated, and seed completed."
