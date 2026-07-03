#!/usr/bin/env bash
set -euo pipefail

# argument taken as rollback to migration
pnpm prisma migrate resolve --rolled-back $0