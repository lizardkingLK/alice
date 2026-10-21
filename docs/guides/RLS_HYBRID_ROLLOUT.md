# Hybrid RLS rollout

Security model: the Supabase **anon key stays public** (Auth, SSR session, Realtime).
Protection is **Postgres RLS + grants**, not key secrecy. The service role key
stays server-only (`createAdminClient` / `apps/api`).

## Strategies

| Strategy                  | When                       | Pattern                                                                                                               |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A — Revoke + RLS deny** | Secrets, admission, tokens | `ENABLE ROW LEVEL SECURITY`; `REVOKE` from `anon`/`authenticated`; no policies; access only via service role / Prisma |
| **B — Policies**          | Collaborative product data | RLS on; `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies mirror product ACL; session client + Realtime keep working       |

Every migration that appends `prisma/sql/supabase_grants.sql` re-grants table DML
to `anon`/`authenticated`. Secrets tables must be **re-revoked after those grants**
(see the lockdown block at the end of `supabase_grants.sql`).

## Phase checklist

### P0 — Secrets / admission (Strategy A) — **this phase**

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
`version_control_connections` (Strategy A). Remaining work: prefer explicit
project selects over `select('*')` where practical (session readers).

**Anon key:** leave `NEXT_PUBLIC_SUPABASE_ANON_KEY` public. Do not move Auth to a
hidden key without a separate Auth/Realtime redesign.

### P1 — Collaborative tables (Strategy B)

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

### P2 — API-only revoke + policy hygiene (`rls_hybrid_p2_rollups_and_review`)

| Table                                                                                     | Status                                                                     |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `work_item_links`                                                                         | **Done** — RLS + revoke (Prisma / charts-API only)                         |
| `work_item_chart_rollups`, `work_item_chart_hierarchy_rollups`, `sprint_burndown_rollups` | **Done** — RLS + revoke                                                    |
| `notifications`                                                                           | **Hardened** — SELECT/UPDATE/DELETE own rows; INSERT via service role only |
| `chat_conversations`                                                                      | **Hardened** — same owner CRUD; `(select auth.uid())`                      |
| `charts`, `chart_shares`                                                                  | Reviewed — already owner/share policies with `(select auth.uid())`         |
| `integrations`, PM/VC connections, `chat_attachments`, allowlist/requests                 | Revoke + RLS — grants footer                                               |

## Negative tests (add with each phase)

- Anon key + no JWT: `GET /rest/v1/<table>` → empty or 401/403, never full dump.
- Authenticated non-admin: cannot read `access_allowlist` / `access_requests` via PostgREST.
- Authenticated: cannot `INSERT`/`UPDATE`/`DELETE` `users` via PostgREST.
- Authenticated: cannot read rollups / `work_item_links` via PostgREST (403 / empty).
- Authenticated: cannot `INSERT` into `notifications` via PostgREST (create is API-only).
- Feature smoke: login gate, allowlist admin UI, Jira/GitHub connect, chat, charts analytics via API, inbox mark-read.

## Related

- [DATABASE.md](./DATABASE.md) — grants baseline
- [PERFORMANCE.md](./PERFORMANCE.md) — SSR vs API reads / RLS reminder
- [ACCESS_ALLOWLIST.md](../features/access/ACCESS_ALLOWLIST.md)
- [SETTINGS_INTEGRATIONS.md](../features/integrations/SETTINGS_INTEGRATIONS.md)
