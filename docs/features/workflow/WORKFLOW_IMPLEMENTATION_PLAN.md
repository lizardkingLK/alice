# Workflow — implementation plan

Status: **Plan**

Atomic steps so developers can land the feature in reviewable slices. Each
step should leave `main` buildable: tests green for the touched packages, docs
updated when user-visible behavior lands in that step.

Authoritative product rules: [WORKFLOW.md](./WORKFLOW.md).  
Test expectations: [WORKFLOW_TESTING.md](./WORKFLOW_TESTING.md).

**Legacy board config:** Board designer UI retired in **Step 9**. On read errors,
always **fallback to seeded default** (no auto-migrate of v1/v2 board JSON in
MVP). Runtime still parses legacy column docs when present.

---

## Phase map

| Step | Name                          | Delivers                                                     |
| ---- | ----------------------------- | ------------------------------------------------------------ |
| 1    | Schema + `state` bridge       | DB columns, types, dual-write helpers                        |
| 2    | Workflow Zod + project API    | Envelope schema, CRUD/save, fallback                         |
| 3a   | Flow canvas + load/save       | XYFlow canvas, layout persist, Save/Discard                  |
| 3b   | Settings sidebar              | Node/edge forms, tooltips / popovers                         |
| 3c   | Designer rules + dirty flag   | Lock/terminal/children/escalation stub, chat dirty           |
| 4    | Board switcher + transitions  | Parallel boards, DnD/API gates, pickers                      |
| 5    | Activity table                | `activities` + transition writers + UI (**Done**)            |
| 6    | Resolution presets            | Form / Preview / JSON designer + runtime dialog (**Done**)   |
| 7    | Charts category + state       | Rollups + Charts UI **State** label                          |
| 8    | Docked Alice + workflow tools | Sidebar, view context, propose/apply confirm                 |
| 9    | Retire board designer         | Remove board config UI; update board feature docs (**Done**) |
| 10   | User-guide polish             | Living guides synced with shipped UI (**Done**)              |
| 11   | Async project create          | Non-blocking create + notify (busy-retry hidden) (**Done**)  |

**Deferred (next)** after MVP: see [§ Deferred (next)](#deferred-next).

---

## Step 1 — Schema + `state` bridge

**Status:** **Done** (as-built below)

**Goal:** Persist single-current workflow placement without breaking enum callers.

1. Add Prisma / migration for `work_items.state` JSONB (nullable initially).
2. Define TypeScript types for `{ workflowId, stateId, category, historyByWorkflow? }`.
3. Add helpers to sync `state` ↔ legacy `status` / `done_at` on write.
4. Optional: generated or trigger-maintained columns for
   `status_category` / `state_id` / `state_workflow_id` (or plan for Step 7).
5. Unit tests for helper mapping and category derivation.
6. Eng note in this folder or WORKFLOW.md “as-built” section when columns land.

**Exit:** New items can store `state`; old rows still work via status fallback.

### As-built (Step 1)

| Piece             | Location                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| Column            | `work_items.state` JSONB nullable — migration `add_work_items_state`          |
| Types / helpers   | `packages/types/src/work-item-state.ts` (exported from `@repo/types`)         |
| Dual-write        | `WorkItemsRepository.create` / `.update` sync `state` + `done_at` from status |
| Tests             | `apps/api/tests/work-items/work-item-state.test.ts`                           |
| Placement mirrors | **Step 7** — `status_category` / `state_id` / `state_workflow_id` + rollups   |

Legacy `status` + `board_column_id` remain authoritative for callers that ignore
`state`. `resolveWorkItemState` derives placement when `state` is null/invalid.
Seeded workflow id constant: `DEFAULT_WORKFLOW_ID` (`wf-default`).

---

## Step 2 — Workflow Zod + project API

**Status:** **Done** (as-built below)

**Goal:** Validate and save the multi-workflow envelope on `projects.workflow_config`.

1. Zod schemas in `packages/types`: envelope, states, edges, presets stubs,
   fork depth, typeBindings disjointness, self-loop / duplicate edge bans.
2. Seeded **default workflow** document constant (used on null/invalid).
3. `safeParse` + fallback helper shared by API and web RSC.
4. Project API: GET/PUT workflow config (manager/admin); team-manager fork-once;
   mark default; delete (with guards).
5. API tests: valid save, invalid → 400, fallback on read, fork rules, promote default.
6. Keep existing board-config readers working via fallback until Step 4/9.

**Exit:** Managers can persist a valid envelope; invalid JSON never crashes reads.

### As-built (Step 2)

| Piece           | Location                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Zod + helpers   | `packages/types/src/api/v1/workflow-config.ts`                                                                   |
| Seeded default  | `createSeededDefaultWorkflowConfig()` / `DEFAULT_WORKFLOW_ID`                                                    |
| Resolve / merge | `resolveWorkflowConfig`, `mergeWorkflowEnvelopeIntoProjectConfig`                                                |
| Routes          | `GET/PUT /api/projects/:id/workflow-config`, `POST …/fork`, `POST …/:workflowId/default`, `DELETE …/:workflowId` |
| Service         | `ProjectsService` workflow methods + team-manager fork gate                                                      |
| Tests           | `apps/api/tests/work-items/workflow-config.test.ts`, `apps/api/tests/projects/projects.workflow-config.test.ts`  |

Legacy board JSON without `schemaVersion`/`workflows` still fails the envelope parse and
**falls back to the seeded default** on workflow reads. Board designer continues
to use `boardConfigSchema` until Steps 4/9.

---

## Step 3 — React Flow designer + Settings

Split into **3a / 3b / 3c** so canvas, Settings forms, and rule wiring land in
reviewable PRs. Board tab designer still exists until Step 9. Preset picker
stubs until Step 6.

### Step 3a — Flow canvas + load/save

**Status:** **Done** (as-built below)

**Goal:** Replace the Workflow tab placeholder with a real graph canvas.

1. Add `@xyflow/react` to `@repo/ui`; export a themed flow-canvas primitive.
2. Workflow tab: resolve envelope → render states as nodes, transitions as edges.
3. Separate `layout` persistence (drag nodes; graph semantics unchanged).
4. Workflow switcher when multiple workflows exist; Save / Discard for dirty layout.
5. Client calls dedicated `GET/PUT …/workflow-config` (optimistic lock).
6. Component tests: canvas mounts from seeded/fallback config; save persists layout.

**Exit:** Managers open Workflow, rearrange nodes, save layout without crashing reads.

### As-built (Step 3a)

| Piece              | Location                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| XYFlow dependency  | `@xyflow/react` in `packages/ui`; styles via `packages/ui/globals.css`                             |
| Flow canvas        | `@repo/ui/components/ui/flow-canvas`                                                               |
| Designer workspace | `apps/web/.../workflow-designer-workspace.tsx` (replaces Board designer on Workflow tab)           |
| Layout helpers     | `apps/web/app/projects/_helpers/workflow-designer.layout.ts`                                       |
| Client API         | `putProjectWorkflowConfig` → `PUT /api/projects/:id/workflow-config`                               |
| Tests              | `apps/web/tests/projects/workflow-designer.layout.test.ts`, `workflow-designer-workspace.test.tsx` |

Settings forms, lock/terminal/children wiring, and chat dirty flag are **3b / 3c**.

### Step 3b — Settings sidebar

**Status:** **Done** (as-built below)

**Goal:** Context-sensitive node/edge editors beside the canvas.

1. **Settings** sidebar: node + edge forms; info tooltips / popovers.
2. Wire fields that already exist on the Zod document (name, category, matchers,
   require-children enum, etc.) — validation UX only; runtime gates stay Step 4.
3. Component tests for Settings field persistence on save/reload.

**Exit:** Selecting a node or edge edits document fields via Settings.

### As-built (Step 3b)

| Piece            | Location                                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| Settings panel   | `workflow-designer-settings.tsx`                                                    |
| Selection        | Node/edge/pane clicks on `FlowCanvas` → Settings                                    |
| State fields     | Name, category (+ tooltips)                                                         |
| Edge fields      | Require children, Who can move (`TransitionRulePermissions`)                        |
| Document patches | `patchStateInDocument` / `patchEdgeInDocument` in layout helpers                    |
| Teams/members    | Passed from project details via `boardDesignerSharedProps`                          |
| Tests            | `workflow-designer-settings.test.tsx`, layout patch tests, workspace selection test |

Lock / Terminal / escalation checkboxes and outbound-edge confirm are **Step 3c**.

### Step 3c — Designer rules + dirty flag

**Status:** **Done** (as-built below)

**Goal:** Finish designer semantics before board runtime (Step 4).

1. Wire **Lock record in this state** and **Terminal state** (outbound-edge
   remove confirm before terminal).
2. Wire **Require children**: Off / All complete / Match parent target.
3. Requires escalation checkbox (preset required on outbound — enforce in Zod;
   preset picker stub until Step 6).
4. Dirty flag for chat (Step 8).
5. Schema / Settings confirmation tests for lock/terminal.

**Exit:** Managers design and save a valid graph for a project (Settings + rules).

### As-built (Step 3c)

| Piece                                   | Location                                                      |
| --------------------------------------- | ------------------------------------------------------------- |
| Lock / Terminal / escalation checkboxes | `workflow-designer-settings.tsx`                              |
| Terminal outbound confirm               | Dialog → `makeStateTerminalInDocument`                        |
| Require children                        | Already in Step 3b Settings                                   |
| Resolution preset stub                  | Disabled picker on edge Settings                              |
| Zod gates                               | Existing envelope validators (API save)                       |
| Dirty flag for chat                     | `data-dirty` + `data-workflow-id` on workspace root           |
| Helpers                                 | `removeOutboundEdgesFromState`, `makeStateTerminalInDocument` |
| Tests                                   | Settings lock/terminal confirm + layout terminal helper       |

---

## Step 4 — Board switcher + transitions

**Status:** **Done** (as-built below; details/backlog pickers still enum-based)

**Goal:** Runtime uses workflows instead of board columns for scoped projects.

1. Board data loader: parse envelope → active workflow from URL/default switcher.
2. Columns = states of active workflow; filter cards by type bindings.
3. DnD + PATCH: edge existence, `allowAnyOf`, require-children, lock-record,
   terminal; optimistic + conflict handling.
4. Details / backlog / create-from-column: state pickers from item workflow.
5. Done-category → `done_at`; Lock record → read-only except state.
6. Update board policy tests; API transition tests for A/B child rules.
7. User-guide drafts can start updating kanban / assign-and-status (finalize in Step 10).

**Exit:** Project board + details honor the designer graph.

### As-built (Step 4)

| Piece               | Location                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Runtime helpers     | `packages/types/.../board-runtime.ts`                                                       |
| Board loader        | `board-data.tsx` via `resolveProjectBoardRuntime`                                           |
| Workflow switcher   | `?workflow=` + kanban select when multiple tabs                                             |
| Type-binding filter | Active workflow bindings filter cards                                                       |
| API graph gates     | `WorkItemService` edge / allowAnyOf / require-children / lock / terminal                    |
| Legacy board        | Still supported when blob is v1/v2 board config                                             |
| Pickers             | Create-from-column uses column status; details/backlog enum pickers deferred                |
| Tests               | `board-runtime.test.ts`, `work-items.workflow-transition.test.ts`, board-data envelope case |

---

## Step 5 — Activity table

**Status:** **Done** (as-built below)

**Goal:** Timeline for field changes, transitions, and resolutions.

1. Implement `activities` per [../work-items/ACTIVITY.md](../work-items/ACTIVITY.md).
2. Extend actions: `workflow_transition`, `escalation_resolved` (+ snapshots).
3. Writers on work-item PATCH / transition path (same transaction).
4. Details **Activity** tab: list + empty state; optional Realtime later.
5. API + UI tests; do not mix into `work_item_worklogs`.

**Exit:** Status/state changes appear on Activity; worklogs stay time-only.

### As-built (Step 5)

| Piece           | Location                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Schema          | `activities` + `ActivityAction` — `packages/db/prisma/migrations/add_activities`                 |
| Shared types    | `packages/types/src/work-item-activity.ts`                                                       |
| API writers     | `ActivitiesService` via work-item create/update + attachment add/remove                          |
| Workflow rows   | `workflow_transition` with `fromStateId` / `toStateId` / `workflowId` / `edgeId` (no status dup) |
| Escalation rows | Action enum reserved; writer deferred to Step 6                                                  |
| RSC + UI        | `getWorkItemActivities`, Activity tab feed, section maximize                                     |
| Realtime        | Deferred (N8)                                                                                    |
| Tests           | `activities.service.test.ts`, `work-items.activity.test.ts`, web feed/tabs                       |

### Adjacent hardening (alice#562) — shipped with Step 5 delivery

Not a Workflow product step, but landed while validating create-project under
pool pressure (same Prisma adapter-pg class of failure):

| Piece             | Location                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| Larger pg pool    | `packages/db` `PG_POOL_MAX` 10 → 20                                        |
| Server retry util | `withBusyRetry` + higher `maxWait` on project create `$transaction`        |
| Stable API code   | `DATABASE_BUSY` (503) via `jsonErrorFromCaught` / `sendRouteMutationError` |
| Client wrapper    | `withApiBusyRetry` on client `apiFetch` + toast “Database is busy…”        |

Issue: [lizardkingLK/alice#562](https://github.com/lizardkingLK/alice/issues/562).  
Guide: [DATABASE_BUSY_RETRY.md](../../guides/DATABASE_BUSY_RETRY.md).

---

## Step 6 — Resolution presets

**Status: Done (as-built)**

**Goal:** Named dialogs with Form / Preview / JSON and runtime collection.

1. Preset Zod + Settings UI (create, rename, load, save-as).
2. MVP fields: text, textarea, select, checkbox; outcomes with labels.
3. Promote edge-local draft → `resolutionPresets` on named save.
4. Transition UI/API: require `resolution` payload when edge/preset demands it.
5. Activity snapshot on resolve.
6. Tests for schema, promote/load, API rejection without resolution.

### As-built

| Piece               | Location                                                |
| ------------------- | ------------------------------------------------------- |
| Payload + helpers   | `packages/types/src/api/v1/workflow-resolution.ts`      |
| Designer editor     | `workflow-resolution-preset-editor.tsx` (edge Settings) |
| API gate + activity | `work-items.service.ts` + `escalation_resolved`         |
| Runtime dialog      | `work-item-resolution-dialog.tsx` via status dropdown   |

**Exit:** Escalation/resolution works end-to-end on configured edges.

---

## Step 7 — Charts category + state

**Status: Done (as-built)**

**Goal:** Rollups and Charts UI match filter strategy.

1. Extend rollup grain: always `status_category`; add `workflow_id` + `state_id`
   for project-scoped queries (migration + triggers as needed).
2. Charts API: multi-project → category; single project → category + **State**.
3. Charts UI: **State** label/dimension when project selected.
4. Repository / API / UI tests for both scopes.

### As-built

| Piece                            | Location                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placement mirrors + rollup grain | migration `chart_rollups_category_state`; `work_items.status_category` / `state_id` / `state_workflow_id`; rollup `status_category` / `workflow_id` / `state_id` |
| Resolve helper (SQL)             | `work_item_chart_resolve_placement` (+ BEFORE trigger sync)                                                                                                      |
| Label fields                     | `category` / `state` in `charts-analytics.ts` (legacy `status` kept)                                                                                             |
| API gate                         | `state` requires single `projectId` (`ChartsService`)                                                                                                            |
| UI Labels                        | Category always; State when project filter set                                                                                                                   |

**Exit:** Status wheel / charts correct for category and per-project state.

---

## Step 8 — Docked Alice + workflow tools

**Goal:** Page-aware chat edits the designer with hard confirm.

1. Replace floating drawer with docked width-sharing sidebar (feature-flag or
   designer-only first is OK).
2. Pass view context into chat session.
3. Tools: `get_workflow_config`, `propose_workflow_patch`, `apply_workflow_patch`
   (apply requires confirmation token / client Apply).
4. Inline **Apply / Reject** card (summary + optional JSON diff); no apply modal.
5. Dirty path: save designer → Apply → reload into canvas without full page refresh.
6. Progress states; validation errors on card.
7. Retire or gate `configure_board_draft` once workflow tools cover it. (**Done** in Step 9)
8. Chat service tests + UI tests for confirm gate.
9. Append [user-guide chat](../../user-guide/chat/use-ai-assistant.md).

**Exit:** Manager can NL-edit workflow only via Apply; dirty save-then-apply works.

---

## Step 9 — Retire board designer

**Status:** **Done** (as-built below)

**Goal:** Single configuration story.

1. Remove board designer workspace UI and board-config write paths that mint
   v1/v2 column docs.
2. Point chat / imports at workflow envelope only.
3. Update [../board/README.md](../board/README.md) and
   [CUSTOM_BOARD_DESIGNER.md](../board/CUSTOM_BOARD_DESIGNER.md) status to
   **Retired / historical** with pointer to this folder.
4. Update [docs/README.md](../../README.md) feature index.
5. Delete or archive obsolete board-config unit tests; keep fallback tests.

**Exit:** No UI path to edit legacy board JSON; reads still fallback safely.

### As-built (Step 9)

| Piece               | Location / change                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Board designer UI   | Removed `board-designer-workspace`, movement/status rules dialogs; **Board** nav tab gone                                       |
| Legacy `?tab=board` | `parseProjectDetailsTab` → `workflow`                                                                                           |
| Alice board draft   | Removed `list_board_entities` / `configure_board_draft` / `board-draft.ts`; historical `configure_board` cards link to Workflow |
| Runtime fallback    | Kept: `boardConfigSchema`, `resolveProjectBoardRuntime`, kanban / DnD guards                                                    |
| Docs                | Board feature + `CUSTOM_BOARD_DESIGNER.md` → Retired / historical; feature index updated                                        |
| Tests               | Removed `project-board-designer` + `chat-board-tools`; sidebar/chat cards updated                                               |

---

## Step 10 — User-guide polish

**Status:** **Done** (as-built below)

**Goal:** Living user docs match shipped UI.

1. Finalize workflow designer, kanban, assign-and-status, chat pages.
2. Ensure `docs/docs-publish.json` entries and `minimumRole: manager` on
   designer page.
3. Run `pnpm --filter web docs:sync` (or prebuild path).
4. Smoke read-through as manager vs member (designer hidden for members).

**Exit:** In-app `/docs` shows accurate guides.

### As-built (Step 10)

| Piece             | Location / change                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Workflow designer | `docs/user-guide/board-and-planning/workflow-designer.md` — living copy; Save/Discard; Board designer retired |
| Kanban            | `kanban-board.md` — Workflow tab only for config; fallback default columns                                    |
| Assign and status | `assign-and-status.md` — Require children / lock / terminal / resolution form labels                          |
| Alice chat        | `use-ai-assistant.md` — Apply/Reject, designer required for Apply, undo/cancel dismiss; no board drafts       |
| Topic index       | `board-and-planning/README.md` — Workflow-only config note                                                    |
| Publish manifest  | `docs/docs-publish.json` — designer page already `minimumRole: manager`                                       |

---

## Step 11 — Async project create (busy-safe)

**Status:** **Done** (as-built below)

**Goal:** Creating a project must not block the admin UI on pool / transaction
pressure. Mirror the **chat async** pattern: accept the request, return quickly,
finish work in the background with existing `withBusyRetry`, then notify the
actor when done.

### Product behavior

1. Client submits create → API accepts and returns **quickly** (e.g. `202` /
   accepted) with a short message: creation will finish shortly.
2. Connection closes; user is unblocked (stay on `/projects` or dismiss the
   create dialog — no waiting spinner on the HTTP call).
3. Server runs create (incl. optional team/sprint) inside the existing
   `withBusyRetry` + longer `$transaction` `maxWait` path.
4. **Success notification (required):** insert inbox notification for the
   creating admin with a **deep link to the new project details page**
   (`/projects/{id}`), not message-only. Reuse notifications realtime (same
   path as `chat_processed`).
5. **Failure notification (required):** notify the same admin that create
   failed (after retries exhausted), with enough context to retry or escalate
   (name/key + short reason). No project link when no row exists.
6. The client **must not** show the global “Database is busy. Retrying…” toast
   for this create call (opt out of `notifyDatabaseBusyRetry` on that path).
   Server-side busy retries still run.

### Success notification shape

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`            | New enum value e.g. `project_created`                                                                                                                 |
| `related_item_id` | New `projects.id`                                                                                                                                     |
| `message`         | Short copy (“**Acme** is ready”)                                                                                                                      |
| Inbox click       | `resolveNotificationHref` → `/projects/{id}` (extend [`resolve-notification-href.ts`](../../apps/web/lib/notifications/resolve-notification-href.ts)) |

### Failure escalation (discussion → plan default)

Today `activities` is **work-item-only** (`work_item_id` NOT NULL + FK). Reusing
that table with an “entity type = projects” flag would force a polymorphic
redesign of the work-item Activity feed — too heavy for Step 11.

**Step 11 default (ship with create):**

1. `project_create_failed` notification to the actor (inbox + realtime).
2. Structured server log / error reporting with a **correlation id** echoed in
   the notification message (support can find the attempt).
3. Optional: store attempt payload (name, key, actor) in notification `message`
   or a small JSON meta later if the notifications table gains `meta`.

**Follow-up (not Step 11):** durable multi-entity audit belongs in a future
**Application logs** platform feature (see Deferred N10) — a common table that
can absorb today’s work-item `activities` after careful indexing. Step 11 stays
**notifications + correlation id + server logs** only. Do **not** overload
work-item `activities` for project create.

### Implementation sketch

| Layer           | Work                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Schema          | Add `NotificationType` values `project_created`, `project_create_failed` (+ migration)                                    |
| API             | `POST /api/projects`: validate → accept → background create with busy retry → notify success (with project id) or failure |
| Web create form | Non-blocking submit; “Creating… you’ll be notified”; suppress busy-retry toast for this mutation                          |
| Inbox           | Extend `resolveNotificationHref` for `project_created` → `/projects/{id}`; copy for failed type                           |
| Docs            | User-guide project create + `DATABASE_BUSY_RETRY.md` toast exception; notifications user-guide type table                 |

### Exit

- Admin is not stuck on create under DB pressure.
- Success notification opens the new project details page.
- Failure notifies the admin with actionable context (and correlation id).
- Busy-retry toast is suppressed only for this create path.

### As-built (Step 11)

| Piece              | Location / change                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Notification types | Prisma `project_created` / `project_create_failed` + migration `add_project_create_notifications`     |
| API                | `POST /api/projects` → **202** via `enqueueCreateProject`; background `withBusyRetry` create + notify |
| Client             | `skipDatabaseBusyRetry` on create; form shows accept message (Jira import deferred to Integrations)   |
| Inbox href         | `project_created` → `/projects/{id}`; failure → no link                                               |
| Docs               | create-project, dashboard-inbox, `DATABASE_BUSY_RETRY.md`                                             |

---

## Suggested PR slicing

Prefer one PR per step (or 1–2 tightly coupled steps). Step 3 is already split
into **3a / 3b / 3c** — keep those separate. Do not combine Step 3 designer with
Step 9 deletion. Activity (5) can parallelize after Step 4 if staffed; presets
(6) need Step 3b Settings shell. Step **11** (async project create) can ship
independently of Steps 7–10; keep it separate from designer work.

---

## Deferred (next)

Implement **after** MVP Steps 1–10 unless a step’s design must reserve schema
hooks (prefer reserved optional fields over building UI now).

| ID  | Item                                    | Notes                                                                                    |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| N1  | **Category lock**                       | Group seal: internal edges OK; remove cross-category outbound before lock; tooltips      |
| N2  | **All-types union board**               | Optional merged strip / read-only overview                                               |
| N3  | **Outcome → target state**              | Resolution buttons may override edge target                                              |
| N4  | **Cross-workflow presets**              | Shared library beyond per-workflow copy-on-fork                                          |
| N5  | **Dynamic fields in resolution forms**  | Reuse project dynamic-fields engine                                                      |
| N6  | **Auto-migrate board v1/v2 → workflow** | Replace fallback-only strategy                                                           |
| N7  | **Workflow doc version / OCC**          | Concurrent editor safety                                                                 |
| N8  | Activity Realtime                       | Optional live feed on details                                                            |
| N9  | Enter-only escalation gates             | MVP is exit-only                                                                         |
| N10 | **Application logs** (platform feature) | See [§ Application logs (N10) — planning inputs](#application-logs-n10--planning-inputs) |
| N11 | **API / observability logs**            | Request/trace logs; prefer **external** sink (not primary DB); own docs/plan             |

Track these in the next implementation plan revision when MVP ships; do not
silently pull them into Steps 1–11. N10/N11 are cross-cutting platform features
with separate document sets — only cross-linked here.

---

## Application logs (N10) — planning inputs

**Not a workflow step.** Future platform feature with its own
`docs/features/application-logs/` (or similar) plan. Captured here so Step 11
and activity work stay aligned.

### Authorization (product)

Logs are **project-scoped**. A reader must be an **active project member** (or
admin via existing ACL), then further filtered by a **visibility / audience**
on each event (or on the query):

| Audience          | Who can see                                                         |
| ----------------- | ------------------------------------------------------------------- |
| **all** (project) | Any project member                                                  |
| **team**          | Members of named team(s) on that project                            |
| **user**          | Named user(s) only (e.g. actor + assignees, or explicit recipients) |

Managers/admins may still have a wider default (project **all**) where product
policy allows; never leak cross-project rows. Enforce in API with the same
membership helpers as work items — not “trust the UI filter.”

Writers stamp `project_id` + `visibility` (and team/user targets when needed)
at insert time so reads stay simple predicate filters.

### Storage shape (direction)

- Common **application log** store: `entity_type` + `entity_id` + `action` +
  `actor_id` + `project_id` + `visibility` + `payload`/`meta` + `created_at`.
- Migrate / dual-write work-item `activities` into this store, then retire the
  WI-only table once readers move.
- Retention + archival policy required before high-volume entities write here.

### Offload to a time / search indexer?

**Yes — recommended as the durable hot path for N10 once volume grows**, not
as a Day-1 blocker if early traffic is small.

| Approach                                                                                    | When                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Postgres first** (partitioned)                                                            | Early MVP of application logs; same tenancy/RLS habits      |
| **Dual-write → external indexer** (OpenSearch / Elasticsearch, ClickHouse, Timescale, etc.) | When timeline scans and fan-out filters dominate primary DB |
| **External as source of truth + thin Postgres pointer**                                     | If primary DB must stay OLTP-only                           |

Same story as N11: do **not** let unbounded log volume compete with CRUD on the
primary DB. Prefer append-only ingest, time-based indexes/partitions, and
query APIs that always require `project_id` + time range.

Application logs (audit/product timeline) and API/observability logs (N11) can
share an **ingest pipeline** but should stay **separate indexes/collections** —
different retention, PII rules, and auth.

### Query optimization techniques (must-haves in the feature plan)

1. **Mandatory filters:** every list query requires `project_id` + bounded
   `created_at` range (no unbounded “all history”).
2. **Composite indexes** aligned to access patterns, e.g.
   `(project_id, created_at DESC)`, `(project_id, entity_type, entity_id, created_at DESC)`,
   and visibility helpers as needed (partial indexes for `visibility = 'all'`).
3. **Partitioning** by time (monthly/weekly) or by `project_id` hash if
   multi-tenant scan cost dominates.
4. **Cursor pagination** on `(created_at, id)` — avoid deep `OFFSET`.
5. **Visibility predicate pushdown** early (project membership ∩ audience) so
   the indexer/DB never returns rows the caller cannot see.
6. **Denormalize carefully** for list cards (actor display name snapshot) to
   avoid N+1 joins on hot paths; keep full payload in `meta`.
7. **Write path:** batch inserts / async ingest; never block user mutations on
   log fan-out (outbox or fire-and-forget with retry).
8. **Read path SLOs:** cap page size; reject queries without time bound; optional
   summary/count endpoints that use approximate or pre-agg where needed.
9. **If external indexer:** map Alice auth → filtered queries (tenant + project
   - visibility terms); never expose a raw cluster to the browser.
10. **Retention jobs** prune/compact old partitions; hot tier vs cold storage.

### Relation to Step 11

Step 11 (async project create) uses **notifications + correlation id + server
logs** only. When N10 ships, project create success/failure _may_ also emit
application-log events (`entity_type = project`) with visibility `user` or
`all` — that is additive, not a prerequisite.
