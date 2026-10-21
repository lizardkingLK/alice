# Hybrid RLS rollout

Security model: the Supabase **anon key stays public** (Auth, SSR session, Realtime).
Protection is **Postgres RLS + grants**, not key secrecy. The service role key
stays server-only (`createAdminClient` / `apps/api`).

**Status:** P0 → P2 + P0.5 select hygiene + negative-test harness — **done**.
Remaining work is optional deploy smoke (below), not further policy migrations.

## Strategies

| Strategy                  | When                       | Pattern                                                                                                               |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A — Revoke + RLS deny** | Secrets, admission, tokens | `ENABLE ROW LEVEL SECURITY`; `REVOKE` from `anon`/`authenticated`; no policies; access only via service role / Prisma |
| **B — Policies**          | Collaborative product data | RLS on; `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies mirror product ACL; session client + Realtime keep working       |

Every migration that appends `prisma/sql/supabase_grants.sql` re-grants table DML
to `anon`/`authenticated`. Secrets tables must be **re-revoked after those grants**
(see the lockdown block at the end of `supabase_grants.sql`).

## Phase checklist

### P0 — Secrets / admission (Strategy A) — **done**

| Table / object                                                                   | Action                                                                                    | Callers after change                                                                    | Must-not-break                                             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `project_management_connections` (was `jira_connections`)                        | RLS + revoke                                                                              | `apps/api` Prisma only                                                                  | Jira OAuth / import                                        |
| `version_control_connections` (GitHub OAuth; was `integrations` provider=github) | RLS + revoke                                                                              | `apps/api` Prisma only                                                                  | GitHub OAuth / PR link                                     |
| `projects.pm_connection_id` / `pm_external`                                      | FK + JSONB (not secrets)                                                                  | RSC/API map to `jira_*` DTOs                                                            | Project Jira link                                          |
| `work_items.pm_external`                                                         | JSONB issue refs                                                                          | RSC/API map to `jira_issue_key`                                                         | Import / display keys                                      |
| `chat_attachments`                                                               | RLS + revoke                                                                              | `apps/api` Prisma only                                                                  | Chat upload / signed URLs                                  |
| `access_allowlist`                                                               | RLS + revoke                                                                              | Gate + admin list via **admin client** / API                                            | Login allowlist, `/users` allowlist tab, guest project ACL |
| `access_requests`                                                                | RLS + revoke                                                                              | Admin list via **admin client**; mutations via API                                      | Contact → requests tab                                     |
| `integrations`                                                                   | Re-revoke (already RLS)                                                                   | API Prisma                                                                              | Settings integrations                                      |
| `users`                                                                          | RLS; **no anon policy**; `authenticated` SELECT; revoke writes for `anon`/`authenticated` | SSR/directory SELECT; writes via service role / API                                     | Sign-in `getDbUser`, assignees, registry                   |
| `projects.github_token`                                                          | **Removed** (VC hybrid)                                                                   | Wire `has_github_token` from `vc_connection_id`; OAuth on `version_control_connections` | GitHub settings card                                       |

**P0.5:** absorbed by VC hybrid — PAT column dropped; secrets live on
`version_control_connections` (Strategy A). Session/API project readers use
shared `projectSessionPostgrestSelect` (no `select('*')` on project rows).

**Anon key:** leave `NEXT_PUBLIC_SUPABASE_ANON_KEY` public. Do not move Auth to a
hidden key without a separate Auth/Realtime redesign.

### P1 — Collaborative tables (Strategy B) — **done**

| Table                                                                                                     | Status / policy sketch                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `saved_views`, `saved_view_shares`                                                                        | **Done** — owner ALL; shared SELECT; shares owner ALL + recipient SELECT (`rls_hybrid_p1_saved_views`) |
| `projects`, `project_members`, `teams`, `team_members`                                                    | **Done** — SELECT via `can_access_project` (`rls_hybrid_p1_project_membership`)                        |
| `work_items`, `comments`, `attachments`, `sprints`, `work_item_worklogs`, `version_control_pull_requests` | **Done** — SELECT via project membership helper                                                        |
| `activities`                                                                                              | **Done** — SELECT tightened to `can_access_project` (was: any auth if parent WI exists)                |

**Helper:** `public.can_access_project(uuid)` — `SECURITY DEFINER`, mirrors
`project-workspace-access` (email allowlist exclusive → project keys; else owner ∪
active `project_members`). Authenticated **writes** remain denied by RLS (no
INSERT/UPDATE/DELETE policies); mutations use service role / Prisma.

### P2 — API-only revoke + policy hygiene — **done**

| Table                                                                                     | Status                                                                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `work_item_links`                                                                         | **Done** — RLS + revoke (Prisma / charts-API only)                                              |
| `work_item_chart_rollups`, `work_item_chart_hierarchy_rollups`, `sprint_burndown_rollups` | **Done** — RLS + revoke                                                                         |
| `notifications`                                                                           | **Hardened** — SELECT/UPDATE/DELETE own rows; INSERT via service role only                      |
| `chat_conversations`                                                                      | **Hardened** — same owner CRUD; `(select auth.uid())`                                           |
| `charts`, `chart_shares`                                                                  | Reviewed — already owner/share policies with `(select auth.uid())`                              |
| `integrations`, PM/VC connections, `chat_attachments`, allowlist/requests                 | Revoke + RLS — grants footer                                                                    |
| `_prisma_migrations`                                                                      | **Done** — RLS + revoke (`rls_hybrid_prisma_migrations_lockdown`); Prisma/`service_role` bypass |

### Out of scope (intentionally deferred)

- **Strategy B write policies** for collaborative tables — product mutations stay on
  service role / Prisma; session clients are SELECT (+ Realtime) only.
- **Hiding the anon key** — would require an Auth/Realtime redesign.

## Negative tests

**Static (always in CI):** `packages/db/tests/rls-hybrid-grants.test.ts` asserts
`supabase_grants.sql` + P0/P2/`_prisma_migrations` lockdown migrations keep
Strategy A `REVOKE`s and users write denies.

**Live PostgREST (opt-in):** `packages/db/tests/rls-hybrid-postgrest.live.test.ts`

```bash
# Anon / no JWT
RUN_RLS_NEGATIVE_TESTS=1 \
  NEXT_PUBLIC_SUPABASE_URL=... \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  pnpm turbo run test --filter=@repo/db -- --run tests/rls-hybrid-postgrest.live.test.ts

# + authenticated denials (prefer a non-admin member access token)
RUN_RLS_NEGATIVE_TESTS=1 \
  NEXT_PUBLIC_SUPABASE_URL=... \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  RLS_NEGATIVE_TEST_USER_JWT=... \
  pnpm turbo run test --filter=@repo/db -- --run tests/rls-hybrid-postgrest.live.test.ts
```

Covered by the live suite:

| Actor         | Assertion                                                                   |
| ------------- | --------------------------------------------------------------------------- |
| Anon          | Strategy A tables → locked or empty                                         |
| Anon          | `users` / `notifications` INSERT denied                                     |
| Authenticated | `access_allowlist` / `access_requests` / rollups / `work_item_links` locked |
| Authenticated | `users` INSERT/UPDATE/DELETE denied                                         |
| Authenticated | `notifications` INSERT denied                                               |

**Deploy smoke (manual):** login gate, allowlist admin UI, Jira/GitHub connect,
chat, charts analytics via API, inbox mark-read.

## Related

- [DATABASE.md](./DATABASE.md) — grants baseline
- [PERFORMANCE.md](./PERFORMANCE.md) — SSR vs API reads / RLS reminder
- [ACCESS_ALLOWLIST.md](../features/access/ACCESS_ALLOWLIST.md)
- [SETTINGS_INTEGRATIONS.md](../features/integrations/SETTINGS_INTEGRATIONS.md)
