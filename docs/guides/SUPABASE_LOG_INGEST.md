# Supabase Logs Ingest

How Alice keeps **Logs Ingest** under the Free-plan quota (1 GB / billing cycle)
and how to diagnose which service is consuming volume.

| Field        | Value                                       |
| ------------ | ------------------------------------------- |
| Status       | **Living**                                  |
| Last updated | 2026-10-21                                  |
| Scope        | Postgres log config, ops scripts, diagnosis |

Related:

- [DATABASE.md](./DATABASE.md) — Prisma / Supabase workflow, pooler URLs
- [RLS_HYBRID_ROLLOUT.md](./RLS_HYBRID_ROLLOUT.md) — PostgREST / RLS lockdown
- Upstream: [Manage Logs Ingest](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest),
  [Custom Postgres config](https://supabase.com/docs/guides/database/custom-postgres-config)

---

## Why it matters

Supabase meters **total log bytes** across Postgres, API gateway, Auth, Storage,
Realtime, Edge Functions, and related services. Free includes **1 GB / month**.
Overage billing is in a grace period into early 2027; Free fair-use limits can
still apply. Prefer reducing volume over turning logging off completely.

---

## Diagnose first

In the Dashboard:

1. **Organization → Usage → Logs Ingest** — confirm project share and trend.
2. **Project → Logs** — sample recent entries by source (**Postgres**, **API**,
   **Auth**, **Realtime**, **Storage**).

| Dominant source | Likely cause                        | First lever                                     |
| --------------- | ----------------------------------- | ----------------------------------------------- |
| Postgres        | Statement / lock / autovacuum noise | Quiet role settings (below)                     |
| API             | High PostgREST traffic              | Fewer RSC round-trips; keep explicit selects    |
| Auth            | Session refresh / login churn       | Avoid redundant `getSession` loops              |
| Realtime        | Board / backlog / details channels  | Product feature — do not remove for quota alone |
| Storage         | Upload / signed-URL volume          | Batch uploads; shorter-lived signed URLs        |

---

## Postgres quiet defaults (Alice)

Checked against production (2026-10-21). Baseline was already conservative
(`log_min_duration_statement=-1`, connections off, `pgaudit.log=none`,
`log_min_messages=warning`). Remaining knobs applied on the `postgres` role:

| Setting          | Target | Notes                                     |
| ---------------- | ------ | ----------------------------------------- |
| `log_statement`  | `none` | Was `ddl`; role override stops DDL spam   |
| `log_lock_waits` | `off`  | Was `on`; re-enable while debugging locks |

**Do not** set `log_statement=all` or a low `log_min_duration_statement` unless
you are actively debugging — both can log full SQL including bind values.

### Apply / verify

```bash
# Apply (also run once against prod via DIRECT_URL)
psql "$DIRECT_URL" -f packages/db/scripts/quiet-postgres-logs.sql

# Snapshot
psql "$DIRECT_URL" -f packages/db/scripts/show-log-settings.sql
```

Role overrides apply to **new** sessions — reconnect Prisma / API after apply.
`pg_settings` in an old session may still show the configuration-file value.

Optional (requires Supabase CLI login), if `pg_cron` is noisy:

```bash
supabase postgres-config update \
  --project-ref <ref> \
  --experimental \
  --config cron.log_statement=false
```

---

## App hygiene (Alice)

Audit notes (2026-10-21):

- [`packages/db/src/client.ts`](../../packages/db/src/client.ts) — Prisma uses
  `@prisma/adapter-pg` with **no** query-event debug logging.
- Migrations under `packages/db/prisma/migrations` — no `RAISE NOTICE` /
  `RAISE LOG` hot paths found.
- Prefer Supavisor **session** pooler for `apps/api` `DATABASE_URL` (see
  [DATABASE.md](./DATABASE.md)) to avoid connection-churn logs if those are
  ever re-enabled.
- Product Realtime (board, backlog, work-item details, comments) is intentional;
  cutting channels for ingest alone is out of scope.

If **API** dominates Logs Explorer later: cache or dedupe hot RSC PostgREST
paths (separate change) — do not disable RLS or switch reads to service role
to “save logs.”

---

## After changes

Ingest totals are **cumulative for the billing cycle**. Judge success by the
**daily rate** over 1–2 days, not an immediate drop in the Usage ring. Re-check
Usage → Logs Ingest and Logs Explorer source mix after quieting.
