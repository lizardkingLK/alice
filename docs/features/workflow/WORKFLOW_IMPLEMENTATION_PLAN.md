# Workflow — implementation plan

Status: **Plan**

Atomic steps so developers can land the feature in reviewable slices. Each
step should leave `main` buildable: tests green for the touched packages, docs
updated when user-visible behavior lands in that step.

Authoritative product rules: [WORKFLOW.md](./WORKFLOW.md).  
Test expectations: [WORKFLOW_TESTING.md](./WORKFLOW_TESTING.md).

**Legacy board config:** do not delete board designer code until **Step 9**.
On read errors, always **fallback to seeded default** (no auto-migrate of v1/v2
board JSON in MVP).

---

## Phase map

| Step | Name                           | Delivers                                               |
| ---- | ------------------------------ | ------------------------------------------------------ |
| 1    | Schema + `state` bridge        | DB columns, types, dual-write helpers                  |
| 2    | Workflow Zod + project API     | Envelope schema, CRUD/save, fallback                   |
| 3    | React Flow designer + Settings | Workflow tab UI, graph/layout, locks, children options |
| 4    | Board switcher + transitions   | Parallel boards, DnD/API gates, pickers                |
| 5    | Activity table                 | `activities` + transition/resolution writers + UI      |
| 6    | Resolution presets             | Form / Preview / JSON designer + runtime dialog        |
| 7    | Charts category + state        | Rollups + Charts UI **State** label                    |
| 8    | Docked Alice + workflow tools  | Sidebar, view context, propose/apply confirm           |
| 9    | Retire board designer          | Remove board config UI; update board feature docs      |
| 10   | User-guide polish              | Living guides synced with shipped UI                   |

**Deferred (next)** after MVP: see [§ Deferred (next)](#deferred-next).

---

## Step 1 — Schema + `state` bridge

**Goal:** Persist single-current workflow placement without breaking enum callers.

1. Add Prisma / migration for `work_items.state` JSONB (nullable initially).
2. Define TypeScript types for `{ workflowId, stateId, category, historyByWorkflow? }`.
3. Add helpers to sync `state` ↔ legacy `status` / `done_at` on write.
4. Optional: generated or trigger-maintained columns for
   `status_category` / `state_id` / `state_workflow_id` (or plan for Step 7).
5. Unit tests for helper mapping and category derivation.
6. Eng note in this folder or WORKFLOW.md “as-built” section when columns land.

**Exit:** New items can store `state`; old rows still work via status fallback.

---

## Step 2 — Workflow Zod + project API

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

---

## Step 3 — React Flow designer + Settings

**Goal:** Replace the Workflow tab placeholder with a real designer (Board tab
designer still exists until Step 9).

1. Add XYFlow / React Flow dependency to the web app (or shared UI if justified).
2. Canvas: states as nodes, transitions as edges; separate `layout` persistence.
3. **Settings** sidebar: node + edge forms; info tooltips / popovers.
4. Wire **Lock record in this state** and **Terminal state** (outbound-edge
   remove confirm before terminal).
5. Wire **Require children**: Off / All complete / Match parent target.
6. Requires escalation checkbox (preset required on outbound — enforce in Zod;
   preset picker can stub until Step 6).
7. Save / discard; dirty flag for chat (Step 8).
8. Component tests for Settings validation UX; schema tests for lock/terminal.

**Exit:** Managers design and save a graph for a project.

---

## Step 4 — Board switcher + transitions

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

---

## Step 5 — Activity table

**Goal:** Timeline for field changes, transitions, and resolutions.

1. Implement `activities` per [../work-items/ACTIVITY.md](../work-items/ACTIVITY.md).
2. Extend actions: `workflow_transition`, `escalation_resolved` (+ snapshots).
3. Writers on work-item PATCH / transition path (same transaction).
4. Details **Activity** tab: list + empty state; optional Realtime later.
5. API + UI tests; do not mix into `work_item_worklogs`.

**Exit:** Status/state changes appear on Activity; worklogs stay time-only.

---

## Step 6 — Resolution presets

**Goal:** Named dialogs with Form / Preview / JSON and runtime collection.

1. Preset Zod + Settings UI (create, rename, load, save-as).
2. MVP fields: text, textarea, select, checkbox; outcomes with labels.
3. Promote edge-local draft → `resolutionPresets` on named save.
4. Transition UI/API: require `resolution` payload when edge/preset demands it.
5. Activity snapshot on resolve.
6. Tests for schema, promote/load, API rejection without resolution.

**Exit:** Escalation/resolution works end-to-end on configured edges.

---

## Step 7 — Charts category + state

**Goal:** Rollups and Charts UI match filter strategy.

1. Extend rollup grain: always `status_category`; add `workflow_id` + `state_id`
   for project-scoped queries (migration + triggers as needed).
2. Charts API: multi-project → category; single project → category + **State**.
3. Charts UI: **State** label/dimension when project selected.
4. Repository / API / UI tests for both scopes.

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
7. Retire or gate `configure_board_draft` once workflow tools cover it.
8. Chat service tests + UI tests for confirm gate.
9. Append [user-guide chat](../../user-guide/chat/use-ai-assistant.md).

**Exit:** Manager can NL-edit workflow only via Apply; dirty save-then-apply works.

---

## Step 9 — Retire board designer

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

---

## Step 10 — User-guide polish

**Goal:** Living user docs match shipped UI.

1. Finalize workflow designer, kanban, assign-and-status, chat pages.
2. Ensure `docs/docs-publish.json` entries and `minimumRole: manager` on
   designer page.
3. Run `pnpm --filter web docs:sync` (or prebuild path).
4. Smoke read-through as manager vs member (designer hidden for members).

**Exit:** In-app `/docs` shows accurate guides.

---

## Suggested PR slicing

Prefer one PR per step (or 1–2 tightly coupled steps). Do not combine Step 3
designer with Step 9 deletion. Activity (5) can parallelize after Step 4 if
staffed; presets (6) need Step 3 Settings shell.

---

## Deferred (next)

Implement **after** MVP Steps 1–10 unless a step’s design must reserve schema
hooks (prefer reserved optional fields over building UI now).

| ID  | Item                                    | Notes                                                                               |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| N1  | **Category lock**                       | Group seal: internal edges OK; remove cross-category outbound before lock; tooltips |
| N2  | **All-types union board**               | Optional merged strip / read-only overview                                          |
| N3  | **Outcome → target state**              | Resolution buttons may override edge target                                         |
| N4  | **Cross-workflow presets**              | Shared library beyond per-workflow copy-on-fork                                     |
| N5  | **Dynamic fields in resolution forms**  | Reuse project dynamic-fields engine                                                 |
| N6  | **Auto-migrate board v1/v2 → workflow** | Replace fallback-only strategy                                                      |
| N7  | **Workflow doc version / OCC**          | Concurrent editor safety                                                            |
| N8  | Activity Realtime                       | Optional live feed on details                                                       |
| N9  | Enter-only escalation gates             | MVP is exit-only                                                                    |

Track these in the next implementation plan revision when MVP ships; do not
silently pull them into Steps 1–10.
