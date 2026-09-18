# Charts aggregation (work-item series)

Status: **Tier 1 in progress** — design locked; implementation stepwise.

Replaces in-memory chart mocks with precomputed **rollup** statistics and
paginated drilldown. Heavy joins per pie slice are out of scope.

Related:

- Product UI: [CHARTS.md](./CHARTS.md)
- DB access: [DATABASE.md](../../guides/DATABASE.md)
- Performance: [PERFORMANCE.md](../../guides/PERFORMANCE.md)
- User guide: [charts.md](../../user-guide/navigation/charts.md)

---

## Naming

| Term | Meaning |
| ---- | ------- |
| Materialized statistics (product language) | Precomputed counts for cheap chart reads |
| Postgres `MATERIALIZED VIEW` | **Not used** — cannot be incrementally updated by triggers |
| **Rollup table** | Normal table maintained by `AFTER` triggers on `work_items` |

---

## Tiers

| Tier | Scope | Status |
| ---- | ----- | ------ |
| **1** | Same Supabase DB: rollup + indexes + series API + paginated drilldown; remove mocks | **Implement now** |
| **2** | Lean `work_items` read model on **Neon**; **Render `reader`**; **Upstash** queue; Express **post-commit** publisher; **Pusher** auth as streamer | Later |
| **3** | Whole-app reads on Neon; **apps rename** first; separate architecture doc | Later |

### Tier 1 locks

- Measure: **`item_count` only** (story points in a later migration)
- Bucket: `(created_at)::date`
- One shared dimensional rollup for categorical charts (pie now; bar later via `GROUP BY`)
- Slice → table: live `work_items`, paginated (not ID lists in the rollup)

### Tier 2 locks

- Browser → Render **reader** → Neon
- Enqueue: Express **post-commit** publisher (generic interceptor) → Upstash
- Neon holds a **lean** `work_items` projection (+ chart reads), not a full row mirror of the whole schema
- Queue **consumer on `worker`**; **reader** HTTP-only
- **Streamer** = Pusher auth/BFF until outgrown
- Cutover: dual-run + feature flag

### Tier 3 locks

- Whole-app Neon reads
- Rename deployables **before** that migration (see below)
- Own follow-up documentation when started; this file only outlines the target

---

## Future apps rename (before Tier 3)

| Today | Target | Role |
| ----- | ------ | ---- |
| `apps/web` | `client` | UI (Vercel) |
| `apps/api` | `writer` | Mutations + post-commit publish (Vercel) |
| — | `reader` | Neon-backed read HTTP API (Render) |
| — | `streamer` | Realtime gateway (Pusher auth / façade) |
| — | `worker` | Long-running jobs, queue consumers, heavy crons (Render or similar) |

Tier 2 may add `reader` / `worker` without renaming `web` / `api`. Rename
`client` / `writer` just before Tier 3.

---

## Tier 1 data model

### Table `work_item_chart_rollups`

| Column | Role |
| ------ | ---- |
| `bucket_date` | `date` from `created_at` |
| `project_id` | uuid |
| `sprint_id` | uuid nullable |
| `status` | work item status |
| `type` | work item type |
| `priority` | work item priority |
| `assignee_id` | uuid nullable |
| `item_count` | int |

- Unique / PK on full grain  
- Secondary index: `(project_id, bucket_date)`

### Triggers

`AFTER INSERT OR UPDATE OR DELETE` on `work_items` (respect `record_status`):

- INSERT → `+1`  
- DELETE / leave active → `-1`  
- Grain field change → `-old` + `+new`

No HTTP or queues inside the trigger.

### Indexes on `work_items`

- `(assignee_id)`  
- `(sprint_id)`  
- `(project_id, status)`  
- Time column as needed for drilldown date filters (`created_at`)

### APIs (sketch)

| Endpoint | Source |
| -------- | ------ |
| `GET` chart series | `SUM(item_count) … GROUP BY labelField` on rollups + optional `from`/`to` |
| `GET` chart drilldown | Paginated `work_items` with same filters + slice key |

Auth/RBAC: same project access as board / work items.

---

## Tier 1 implementation steps

Do in order. Each step should be reviewable on its own when practical.

### Step 1 — Schema: indexes + rollup + backfill + triggers

**Docs:** this file (already); note migration name in [CHARTS.md](./CHARTS.md) data strategy when landed.

**Code:**

1. Prisma model `work_item_chart_rollups` + migration SQL  
2. Indexes on `work_items` (assignee, sprint, project+status, created_at as needed)  
3. Backfill `INSERT … SELECT … GROUP BY` from existing active work items  
4. Trigger function + triggers on `work_items`  
5. `pnpm db generate` / types as usual  

**Verify:** insert/update/delete a work item in dev; rollup counts move correctly.

### Step 2 — API: series + drilldown

**Docs:** document routes under API section in this file (fill exact paths when coded).

**Code:**

1. `apps/api` routes/service/repository for series + drilldown  
2. Wire types in `@repo/types`  
3. Unit/integration tests for grouping filters and pagination  

**Verify:** authenticated curl/HTTP against a project with known WI distribution.

### Step 3 — Web: replace mocks

**Docs:** update [CHARTS.md](./CHARTS.md) widget section (mock → live); user guide if labels/filters change for end users.

**Code:**

1. Client fetch series for pie/donut  
2. Slice click → drilldown fetch into existing grouped table  
3. Remove / stop using `charts-sample.data.ts` for the Chart widget  
4. Web tests for wiring helpers if any  

**Verify:** `/charts/[id]` pie matches board/work-item reality for a project filter.

### Step 4 — Docs polish + sync

1. Finalize this file (status, exact paths, migration folder name)  
2. [CHARTS.md](./CHARTS.md) + [README.md](./README.md) links  
3. User guide note if UX copy changes  
4. `pnpm --filter web docs:sync`  

---

## Tier 2 / 3 (not in current implementation)

```text
writer post-commit → Upstash → worker apply → Neon
client → reader (JWT + ACL) → Neon
worker/reader → Pusher → client invalidate
```

Whole-app Neon reads and the apps rename are **Tier 3**; expand in a dedicated
architecture doc when that program starts.

---

## Non-goals (Tier 1)

- Neon / Render / Upstash / apps rename  
- Story points on the rollup  
- Postgres `REFRESH MATERIALIZED VIEW`  
- Per-chart-type duplicate rollup tables  
- Non-pie chart types in the UI (schema remains reusable)  
