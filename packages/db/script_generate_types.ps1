# Regenerates Supabase client types into @repo/types (overwrites the file).
# Requires packages/db/.env with DIRECT_URL set to the non-pooled Postgres URL.
#
# Usage (from repo root):
#   pnpm db generate:win
# Or from packages/db:
#   powershell -NoProfile -ExecutionPolicy Bypass -File ./script_generate_types.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"').Trim("'")
      Set-Item -Path "env:$name" -Value $value
    }
  }
}

if (-not $env:DIRECT_URL) {
  Write-Error 'error. DIRECT_URL is not set. Copy sample.env to .env and fill in values.'
}

pnpm exec tsx src/env.ts

$output = Join-Path $PSScriptRoot '../types/src/generated/supabase/database.types.ts'
$outputDir = Split-Path $output -Parent
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

pnpm exec supabase gen types typescript `
  --db-url $env:DIRECT_URL `
  --schema public |
  Out-File -FilePath $output -Encoding utf8

Write-Host "info. wrote $output"
