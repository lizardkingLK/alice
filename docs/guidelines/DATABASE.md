# Database workflow

See also: [`docs/database/ER_DIAGRAM.md`](../database/ER_DIAGRAM.md) — proposed entity model from the 1BT-JIRA task breakdown.

## Packages

| Package                | Role                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `@repo/db`             | Prisma schema, SQL migrations, seeds, type generation orchestration |
| `@repo/types`          | Supabase `Database` types only (generated, committed)               |
| `apps/web`, `apps/api` | Supabase SDK for all runtime queries — do not import `@repo/db`     |

## Environment (`packages/db/.env`)

Copy `packages/db/sample.env` to `.env`:

- `DIRECT_URL` — non-pooled Postgres URL (`db.<ref>.supabase.co:5432`) for migrations and type generation
- `DATABASE_URL` — pooled URL (validated alongside other vars)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required for `pnpm db seed`

Env vars are validated via `packages/db/src/env.ts` on `pnpm db checktypes`, `pnpm db generate`, `pnpm db seed`, and `pnpm db validate` (via `prisma.config.ts`). CI skips validation when `GITHUB_ACTIONS=true`.

## Commands (from repo root)

```bash
pnpm db validate          # Prisma schema lint — no DB connection (runs in CI)
pnpm db migrate:deploy    # Apply pending migrations
pnpm db migrate:reset     # Drop all tables and re-apply migrations (dev only)
pnpm db migrate:status    # Check DB matches migrations (needs DIRECT_URL)
pnpm db generate          # Regenerate Supabase types into @repo/types
pnpm db seed              # Idempotent seed data (see below)
pnpm db create:migrate <name>  # Create migration → deploy → generate → seed
```

## Typical schema change flow

1. Edit `packages/db/prisma/schema.prisma`
2. `pnpm db create:migrate add_my_table`
3. Review generated SQL under `packages/db/prisma/migrations/`
4. Commit migration + updated `packages/types/src/generated/supabase/database.types.ts`

## Supabase grants

Prisma creates objects as `postgres`. The Supabase Data API (`anon`, `authenticated`, `service_role`) needs explicit grants on `public` or seed and client queries fail with `permission denied for schema public`.

- Baseline: `0_init_supabase` includes grants from `prisma/sql/supabase_grants.sql`
- `create:migrate` appends the same grants block to every new migration
- After `migrate:reset`, grants are reapplied automatically via migrations

## Seed data (`pnpm db seed`)

Idempotent dev sample data in `packages/db/src/seed.ts`:

| Entity     | Sample                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Users      | `admin@alice.dev`, `manager@alice.dev`, `member@alice.dev` (+ matching Supabase Auth accounts) |
| Project    | `ALICE` — Alice Platform                                                                       |
| Team       | Platform Team (manager + member)                                                               |
| Sprints    | Sprint 1 (active), Sprint 2 (planned)                                                          |
| Work items | Epic → Story → Task in sprint; one backlog story                                               |
| Other      | Comments (threaded), attachment, notifications                                                 |

Dev password: set `SEED_USER_PASSWORD` in `packages/db/.env` (see `sample.env`).

## Using types in apps

```typescript
import type { Database, Tables } from '@repo/types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient<Database>(url, key);
type Instrument = Tables<'instruments'>;
```

Add `@repo/types` as a dependency in `web` or `api` when you adopt typed clients.

## CI

| Step                     | Job                                    | Needs DB secret?                 |
| ------------------------ | -------------------------------------- | -------------------------------- |
| `pnpm db validate`       | `validate_and_test` (all PRs)          | No                               |
| `pnpm db migrate:status` | `validate_database` (main deploy only) | Yes — `DIRECT_URL` GitHub secret |

## Single-database warning

This project uses one Supabase database for dev and production. Migrations must be additive. Seeds must be idempotent (check-before-insert). Never run destructive seeds against shared data.
