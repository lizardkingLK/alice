# Database workflow

See also: [`docs/database/ER_DIAGRAM.md`](../database/ER_DIAGRAM.md) — entity model from the 1BT-JIRA task breakdown. [`docs/database/AUDIT_COLUMNS.md`](../database/AUDIT_COLUMNS.md) — audit metadata conventions and helpers. [`docs/database/WORK_ITEM_DESCRIPTION.md`](../database/WORK_ITEM_DESCRIPTION.md) — TipTap JSON for `work_items.description`. Planned new-project bootstrap (migrate, Storage, Google, SMTP): [`docs/features/platform/DAY_ONE_SETUP.md`](../features/platform/DAY_ONE_SETUP.md).

## Packages

| Package       | Role                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| `@repo/db`    | Prisma schema, SQL migrations, seeds, Prisma Client factory                             |
| `@repo/types` | Supabase `Database` types and generated Prisma Client (committed)                       |
| `apps/web`    | supabase-js for RSC reads, Auth, Storage — do not import `@repo/db`                     |
| `apps/api`    | Prisma Client for table mutations; supabase-js for Auth, Storage, RPC, and joined reads |

## Environment (`packages/db/.env`)

Copy `packages/db/sample.env` to `.env`:

- `DIRECT_URL` — non-pooled Postgres URL (`db.<ref>.supabase.co:5432`) for migrations and type generation
- `DATABASE_URL` — Supavisor **session** pooler for Prisma Client in `apps/api`. In the dashboard: **Connect** → **ORMs** / **Connection pooling** → **Session** (port **5432**). Docs: [Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres#pooler-session-mode) and [Prisma](https://supabase.com/docs/guides/database/prisma) (step 3: string ending in `:5432`). Direct link: [Connect with session method](https://supabase.com/dashboard/project/_?showConnect=true&method=session). Do **not** use the Transaction string (`:6543?pgbouncer=true`); the client rewrites that host/port to session `5432` if pasted by mistake. The `pg` pool uses `uselibpqcompat=true&sslmode=require` (encrypt, do not verify-full) so current `pg` does not reject Supavisor's certificate chain.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required for `pnpm db seed`

`apps/api` also requires `DATABASE_URL` (see `apps/api/sample.env`). Do not use `DIRECT_URL` in the API process.

Env vars are validated via `packages/db/src/env.ts` on `pnpm db checktypes`, `pnpm db generate`, `pnpm db seed`, and `pnpm db validate` (via `prisma.config.ts`). CI skips validation when `GITHUB_ACTIONS=true`.

## Commands (from repo root)

```bash
pnpm db validate          # Prisma schema lint — no DB connection (runs in CI)
pnpm db migrate:deploy    # Apply pending migrations
pnpm db migrate:reset     # Drop all tables and re-apply migrations (dev only)
pnpm db migrate:status    # Check DB matches migrations (needs DIRECT_URL)
pnpm db generate          # Regenerates Supabase types + Prisma Client into @repo/types
pnpm db generate:client   # Prisma Client only (`packages/types/src/generated/prisma`)
pnpm db seed              # Idempotent seed data (see below)
pnpm db seed:reset        # Wipe public rows, auth.users, and storage, then seed
pnpm db create:migrate <name>  # Create migration → deploy → generate → seed
```

## Typical schema change flow

1. Edit `packages/db/prisma/schema.prisma`
2. `pnpm db create:migrate add_my_table`
3. Review generated SQL under `packages/db/prisma/migrations/`
4. Commit migration + updated `packages/types/src/generated/supabase/database.types.ts` and `packages/types/src/generated/prisma/`

## Supabase grants

Prisma creates objects as `postgres`. The Supabase Data API (`anon`, `authenticated`, `service_role`) needs explicit grants on `public` or seed and client queries fail with `permission denied for schema public`.

- Baseline: `0_init_supabase` includes grants from `prisma/sql/supabase_grants.sql`
- `create:migrate` appends the same grants block to every new migration
- After `migrate:reset`, grants are reapplied automatically via migrations

## Seed data (`pnpm db seed`)

Idempotent dev sample data in `packages/db/src/seed.ts`:

| Entity     | Sample                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Users      | Core: `admin@alice.dev`, `manager@alice.dev`, `member@alice.dev`. Plus 18 squad members (`firstname.lastinitial@alice.dev`, ASCII-folded). All have Auth accounts. |
| Allowlist  | Domain `alice.dev` (`access_allowlist`) so seed emails pass admission                                                                                              |
| Project    | `ALICE` — Alice Platform                                                                                                                                           |
| Team       | Platform Team (manager + member)                                                                                                                                   |
| Sprints    | Sprint 1 (active), Sprint 2 (planned)                                                                                                                              |
| Work items | Epic → Story → Task → Issue via `parent_id`; one backlog story — each with TipTap JSON descriptions (headings, lists, bold/italic/code)                            |
| Other      | Comments (threaded), attachment, notifications                                                                                                                     |

Re-running seed refreshes work item descriptions on existing seed titles. Format: [`WORK_ITEM_DESCRIPTION.md`](../database/WORK_ITEM_DESCRIPTION.md).

Dev password: set `SEED_USER_PASSWORD` in `packages/db/.env` (see `sample.env`).

### Fresh start (`pnpm db seed:reset`)

Destructive and opt-in. Truncates every `public` table except `_prisma_migrations`, `TRUNCATE`s `auth.users` (sessions/identities go with it), and empties:

- `alice_storage_attachments`
- `alice_storage_profile_pictures`
- `alice_storage_profile_covers`
- `alice_storage_project_logos`
- `alice_storage_project_covers`
- `alice_storage_chat_history`

Then runs the same seed as `pnpm db seed`. Equivalent: `SEED_RESET=1 pnpm db seed`.

This project uses one Supabase database for shared environments. Do not run `seed:reset` unless you intend to drop **all** app rows, Auth users, and files in those buckets.

## Using types in apps

```typescript
import type { Database, Tables } from '@repo/types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient<Database>(url, key);
type Instrument = Tables<'instruments'>;
```

Add `@repo/types` as a dependency in `web` or `api` when you adopt typed clients.

For supabase-js writes (web reads stay on PostgREST), spread audit helpers from `@repo/types/audit`. Express mutations use Prisma Client via `@repo/db` and `apps/api/src/lib/prisma-audit.ts` (Date objects instead of ISO strings):

```typescript
import { prisma } from '../lib/prisma';
import { prismaAuditCreate } from '../lib/prisma-audit';

await prisma.teams.create({
  data: { name, manager_id, ...prismaAuditCreate(actorId) },
});
```

## CI

| Step                     | Job                                    | Needs DB secret?                 |
| ------------------------ | -------------------------------------- | -------------------------------- |
| `pnpm db validate`       | `validate_and_test` (all PRs)          | No                               |
| `pnpm db migrate:status` | `validate_database` (main deploy only) | Yes — `DIRECT_URL` GitHub secret |

## Single-database warning

This project uses one Supabase database for dev and production. Migrations must be additive. Default `pnpm db seed` stays idempotent (check-before-insert). Use `pnpm db seed:reset` only when you intentionally want a wipe-and-reload.
