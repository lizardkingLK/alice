# Sprint Burndown Chart — Design & Implementation Plan

## 1. Domain model

### 1.1 `work_items`

| Column         | Type             | Role in burndown                                                           |
| -------------- | ---------------- | -------------------------------------------------------------------------- |
| `id`           | `uuid`           | Item identity                                                              |
| `sprint_id`    | `uuid?`          | Sprint scope (`NULL` = backlog)                                            |
| `story_points` | `int?`           | **Estimated effort** per item. `NULL` is treated as 0 throughout.          |
| `status`       | `WorkItemStatus` | **Finished marker**: `'Done'` means the item is complete.                  |
| `updated_at`   | `timestamptz`    | Used as a **proxy "done_at"** until a dedicated field is added (see §6.1). |

### 1.2 `sprints`

| Column       | Type           | Role in burndown                                                                           |
| ------------ | -------------- | ------------------------------------------------------------------------------------------ |
| `start_date` | `date`         | Burndown series start (inclusive).                                                         |
| `end_date`   | `date`         | Burndown series end (inclusive).                                                           |
| `status`     | `SprintStatus` | `'active'` / `'closed'` governs whether the actual-remaining line is still live or frozen. |
| `project_id` | `uuid`         | Used to join teams (for capacity-ideal variant).                                           |

### 1.3 `team_members` (for capacity-ideal line only)

| Column       | Type           | Meaning                                                             |
| ------------ | -------------- | ------------------------------------------------------------------- |
| `capacity`   | `int?`         | Raw story points the member can deliver **per sprint** (e.g. `40`). |
| `allocation` | `int?`         | Percentage of time dedicated to this team (e.g. `50` = 50%).        |
| `status`     | `RecordStatus` | Only `'active'` members count.                                      |

**Effective points per member per sprint:**

```
effective_capacity = capacity * (allocation / 100)
```

**Team total sprint capacity:**

```
team_capacity = Σ effective_capacity   for all active team_members
```

---

## 2. Definitions

| Term                         | Definition                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estimated total**          | `Σ story_points` for all work items in the sprint. Items with `NULL` points count as 0.                                                                                        |
| **Finished points (day d)**  | `Σ logged_hours` of work logs with `logged_at ≤ d` (mapping: `1 hour = 1 point`). If there are no work logs for the sprint, fall back to `Σ story_points` whose `done_at ≤ d`. |
| **Remaining points (day d)** | `estimated_total − finished_points(d)`                                                                                                                                         |
| **Ideal remaining (day d)**  | Linear interpolation from `estimated_total` on `start_date` to `0` on `end_date`.                                                                                              |
| **Sprint duration**          | Total calendar days = `end_date − start_date + 1` (inclusive on both ends).                                                                                                    |
| **Today marker**             | For an active sprint, the series is emitted up to `min(today, end_date)`. Future days are omitted from the actual line but the ideal line always runs to `end_date`.           |

---

## 3. Burndown series algorithm

### 3.1 Inputs

- `sprint`: `{ start_date, end_date, status }`
- `work_items[]`: each with `{ story_points, done_at }` (used as fallback when there are no work logs yet)
- `work_logs[]` (optional): each with `{ logged_at, logged_hours }` (drives remaining when present)

### 3.2 Generation (server-side, in TypeScript)

```ts
type BurndownPoint = {
  date: string; // ISO date "YYYY-MM-DD"
  remaining: number; // actual remaining points (null after today for active sprints)
  ideal: number; // ideal remaining points
};

function computeBurndown(
  sprint: { start_date: string; end_date: string; status: string },
  items: { story_points: number | null; done_at: string | null }[],
  workLogs: Array<{ logged_at: string; logged_hours: number }>
): BurndownPoint[] {
  const start = new Date(sprint.start_date);
  const end = new Date(sprint.end_date);
  const today = new Date();

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.story_points ?? 0),
    0
  );
  const hasWorkLogs = workLogs.length > 0;

  const durationDays = (end.getTime() - start.getTime()) / 86_400_000; // total days

  const series: BurndownPoint[] = [];

  for (
    let current = new Date(start);
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const dayLabel = current.toISOString().slice(0, 10);

    // Ideal: linear from estimatedTotal to 0 over [start, end]
    const elapsed = (current.getTime() - start.getTime()) / 86_400_000;
    const ideal = Math.max(0, estimatedTotal * (1 - elapsed / durationDays));

    // Actual: only emit for days that have already passed (or are today)
    const isPast = current <= today;
    let remaining: number | null = null;
    if (isPast) {
      remaining = hasWorkLogs
        ? Math.max(
            0,
            // Simple mapping: treat 1 logged hour as 1 spent point.
            estimatedTotal -
              workLogs.reduce((sum, log) => {
                const loggedDay = log.logged_at.slice(0, 10);
                return loggedDay <= dayLabel ? sum + log.logged_hours : sum;
              }, 0)
          )
        : items.reduce((sum, item) => {
            const doneBefore =
              item.done_at !== null && item.done_at <= dayLabel;
            return doneBefore ? sum : sum + (item.story_points ?? 0);
          }, 0);
    } // null = future; UI omits the dot

    series.push({ date: dayLabel, remaining, ideal });
  }

  return series;
}
```

> **Note on `done_at`:** `done_at` is still set when a work item transitions to `Done`, and cleared when
> it transitions away from `Done`. The burndown uses work logs (`logged_hours`) when present, and falls
> back to `done_at` when no work logs exist for the sprint.

### 3.3 Edge cases

| Scenario                                         | Handling                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `story_points = NULL`                            | Treated as `0` everywhere (consistent with sprint report).               |
| Sprint with zero estimated points                | Both lines are flat at `0`.                                              |
| `start_date === end_date` (1-day sprint)         | One data point emitted; ideal starts and ends at same value.             |
| Item moved out of sprint after being marked Done | Excluded from scope entirely (query only includes `sprint_id = sprint`). |
| Sprint `status = 'closed'`                       | Actual line runs through `end_date` (not capped at today).               |
| Sprint `status = 'active'`                       | Actual line stops at today; future days show only ideal.                 |
| Sprint starts in the future                      | No actual line emitted yet; only ideal series returned.                  |

---

## 4. API contract

### Request

```
GET /api/sprints/:id/burndown
Authorization: Bearer <token>
```

### Response

```jsonc
{
  "sprint": {
    "id": "...",
    "name": "Sprint 17",
    "startDate": "2026-07-21",
    "endDate": "2026-08-01",
    "status": "active",
  },
  "estimatedTotal": 42,
  "series": [
    { "date": "2026-07-21", "remaining": 42, "ideal": 42 },
    { "date": "2026-07-22", "remaining": 38, "ideal": 38.18 },
    // ...
    { "date": "2026-07-29", "remaining": 11, "ideal": 14.0 },
    { "date": "2026-07-30", "remaining": null, "ideal": 10.18 }, // future
    { "date": "2026-07-31", "remaining": null, "ideal": 6.36 },
    { "date": "2026-08-01", "remaining": null, "ideal": 0 },
  ],
}
```

- `remaining: null` indicates a future day — the chart omits the actual-line dot.
- `ideal` values are floating-point (two decimal places is enough precision).

---

## 5. Team capacity, allocation, and spent-time tracking

### 5.1 Definitions

| Term                   | Column                    | Unit            | Meaning                                                                                          |
| ---------------------- | ------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| **Capacity**           | `team_members.capacity`   | story points    | Raw points a member can deliver **per sprint** at 100% allocation (e.g. `40`).                   |
| **Allocation**         | `team_members.allocation` | percent (0–100) | Fraction of their time dedicated to this team (e.g. `50` = half-time).                           |
| **Effective capacity** | derived                   | story points    | `capacity × (allocation / 100)` — usable points for this team this sprint.                       |
| **Spent points**       | derived                   | story points    | Sum of `story_points` of work items assigned to the member with `status = 'Done'` in the sprint. |

### 5.2 "Spent out of allocated" progress

For each team member in a sprint the UI can render a progress indicator:

```
progress = spent_points / effective_capacity   (clamped 0–1 for the bar)
label    = "{spent} / {effective_capacity} pts"
```

- If `capacity` or `allocation` is `NULL` the effective capacity is treated as unknown and the
  progress bar is hidden; only the raw spent points are shown.
- If `effective_capacity = 0` the indicator shows "— pts available".

### 5.3 Where the user edits capacity & allocation

`capacity` and `allocation` are set **per team member** and are edited inline from the
**team detail / members table**. A new dedicated endpoint handles these updates:

```
PATCH /api/teams/:teamId/members/:userId
Body: { capacity?: number | null, allocation?: number | null }
```

**Validation rules:**

- `capacity`: integer ≥ 0, or `null` (unset).
- `allocation`: integer 0–100, or `null` (unset).

### 5.4 Capacity-aware ideal line (burndown variant)

The base burndown uses a **simple linear ideal** (§3.2). A capacity-aware variant replaces it:

```
daily_burn_rate = team_capacity / sprint_duration_days
ideal(d) = max(0, estimated_total − daily_burn_rate × elapsed_days(d))
```

where `team_capacity = Σ effective_capacity` for all active members. This variant is activated
once `capacity` / `allocation` are populated for the team. Implement alongside or after Phase 3
of the base burndown.

### 5.5 Required implementation steps for §5.3

| Step                         | File                                                | Change                                      |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------- |
| **A — API endpoint**         | `apps/api/src/routes/api/teams/teams.route.ts`      | Add `PATCH /:teamId/members/:userId`        |
| **B — Repository method**    | `apps/api/src/routes/api/teams/teams.repository.ts` | Add `updateMember(teamId, userId, patch)`   |
| **C — Types schema**         | `packages/types/src/teams.ts`                       | Add `updateTeamMemberSchema`                |
| **D — Frontend inline edit** | team detail page / members table                    | Inline capacity + allocation inputs per row |

---

## 6. Required implementation steps

### 6.1 DB: add `work_items.done_at` (migration)

The burndown needs a **per-day finished timestamp**. The current `work_items.status = 'Done'`
tells _whether_ an item is done but not _when_ it became done.

**Proposed column:**

```sql
ALTER TABLE work_items
  ADD COLUMN done_at timestamptz NULL;
```

**Backend rule (in `workItems.repository.ts`):**

```ts
// When status changes to 'Done', set done_at = now()
if (input.status === 'Done' && current.status !== 'Done') {
  patch.done_at = new Date().toISOString();
}
// When status changes away from 'Done', clear done_at
if (input.status !== 'Done' && current.status === 'Done') {
  patch.done_at = null;
}
```

`done_at` is populated by the backend rule in §6.1, so there is no longer an `updated_at`
workaround for the burndown timing.

### 6.2 Backend: new route `GET /api/sprints/:id/burndown`

Files to create/modify:

| File                                                    | Change                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/api/sprints/sprints.route.ts`      | Add `GET /:id/burndown` handler                                                                       |
| `apps/api/src/routes/api/sprints/sprints.service.ts`    | Add `getBurndownSeries()` method                                                                      |
| `apps/api/src/routes/api/sprints/sprints.repository.ts` | Add `getWorkItemsForBurndown(sprintId)` (id + story_points + done_at for fallback) and work-log query |

**`getWorkItemsForBurndown` query:**

```ts
supabase
  .from('work_items')
  .select('id, story_points, done_at')
  .eq('sprint_id', sprintId);
```

### 6.3 Frontend: replace mock data in `BurndownWidget`

Files to modify:

| File                                                        | Change                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/web/app/dashboard/_components/dashboard-widgets.tsx`  | `BurndownWidget` fetches real data                                                 |
| `apps/web/app/dashboard/_components/dashboard-mock-data.ts` | Remove `BURNDOWN_DATA` / `BURNDOWN_CONFIG` once replaced                           |
| `apps/web/app/dashboard/_components/dashboard-data.tsx`     | (create or extend) Server component that prefetches burndown for the active sprint |

The `BurndownWidget` should receive the burndown series as a prop (server-prefetched) or fetch it
client-side with SWR/useEffect. Given the dashboard pattern (RSC shell + client widgets), the
simplest approach is to pass `initialBurndownData` as a prop from an RSC data layer, matching the
existing pattern in `dashboard-data.tsx`.

### 6.4 Chart axis

The x-axis should show the `date` label. Prefer abbreviated date labels
(`"Jul 21"`, `"Jul 22"`) rather than raw ISO strings. Recharts `XAxis` `tickFormatter`:

```ts
tickFormatter={(iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

---

## 7. Phased delivery

| Phase                        | Scope                                                      | Prerequisite       |
| ---------------------------- | ---------------------------------------------------------- | ------------------ |
| **1 — Schema**               | Add `work_items.done_at` column + migration + backend rule | None               |
| **2 — API**                  | `GET /api/sprints/:id/burndown`                            | Phase 1            |
| **3 — Dashboard widget**     | Replace `BurndownWidget` mock with real data from Phase 2  | Phase 2            |
| **4 — Sprint detail page**   | Optionally embed burndown on `apps/web/app/sprints/[id]/`  | Phase 3            |
| **5 — Capacity-aware ideal** | Use `team_members.capacity + allocation` to compute slope  | Team-form UI wired |

---

## 8. Related docs

- [Sprint feature overview](./README.md)
- [Dashboard feature overview](../dashboard/README.md)
- [Work items](../work-items/)
- [TRD](../../architecture/TRD.md) — data model reference
- DB schema: `packages/db/prisma/schema.prisma`
