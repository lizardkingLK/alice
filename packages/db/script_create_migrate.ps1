# Create a new migration from schema.prisma changes (after baseline 0_init_supabase).
# Diffs live DB (DIRECT_URL) -> schema.prisma — no shadow database required.
#
# Usage (from repo root):
#   pnpm db create:migrate:win add_sprints
# Or from packages/db:
#   powershell -NoProfile -ExecutionPolicy Bypass -File ./script_create_migrate.ps1 add_sprints
#
# Baseline (one-time, already committed as 0_init_supabase) used:
#   prisma migrate diff --from-empty --to-schema prisma/schema.prisma
#   prisma migrate resolve --applied 0_init_supabase

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$MigrationName
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

. (Join-Path $PSScriptRoot 'script_load_db_env.ps1')

if (-not $env:DIRECT_URL) {
  throw 'error. DIRECT_URL is required in packages/db/.env (used by prisma.config.ts).'
}

$migrationDir = Join-Path 'prisma/migrations' $MigrationName
$migrationSql = Join-Path $migrationDir 'migration.sql'

if (Test-Path $migrationDir) {
  $existingSql = Join-Path $migrationDir 'migration.sql'
  if (-not (Test-Path $existingSql)) {
    Write-Host "info. removing incomplete migration directory: $migrationDir"
    Remove-Item -Path $migrationDir -Recurse -Force
  } else {
    Write-Error "error. migration directory already exists: $migrationDir"
  }
}

# Diff BEFORE creating the migration folder — Prisma scans all subdirs under migrations/.
$sql = & pnpm exec prisma migrate diff `
  --from-config-datasource `
  --to-schema prisma/schema.prisma `
  --script

if ($LASTEXITCODE -ne 0) {
  throw 'error. prisma migrate diff failed.'
}

$sql = ($sql | Out-String).Trim()
$sql = ($sql -split "`r?`n" | Where-Object { $_ -notmatch 'injected env' }) -join "`n"

if ([string]::IsNullOrWhiteSpace($sql)) {
  Write-Host 'info. no schema changes detected. nothing to migrate.'
  exit 0
}

New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null

$grantsPath = Join-Path $PSScriptRoot 'prisma/sql/supabase_grants.sql'
$grants = Get-Content -Path $grantsPath -Raw
$fullSql = "$sql`n`n$grants"

$sqlPath = Join-Path $PSScriptRoot $migrationSql
[System.IO.File]::WriteAllText(
  $sqlPath,
  $fullSql.TrimEnd() + "`n",
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "info. created $migrationSql"
Write-Host 'info. review the SQL before continuing.'

pnpm exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  throw 'error. prisma migrate deploy failed.'
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'script_generate_types.ps1')

pnpm run seed
if ($LASTEXITCODE -ne 0) {
  throw 'error. seed failed.'
}

Write-Host 'info. migration applied, types regenerated, and seed completed.'
