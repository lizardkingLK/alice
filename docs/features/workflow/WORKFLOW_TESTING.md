# Workflow — testing plan

Status: **Plan**

Pairs with [WORKFLOW.md](./WORKFLOW.md) and
[WORKFLOW_IMPLEMENTATION_PLAN.md](./WORKFLOW_IMPLEMENTATION_PLAN.md).
Follow monorepo norms: Vitest via `pnpm turbo run test --filter=…`, shared
schemas in `packages/types`, API tests under `apps/api/tests`, web under
`apps/web/tests`. See [TESTING_DEVELOPMENT_FLOW.md](../../guides/TESTING_DEVELOPMENT_FLOW.md).

---

## Principles

- Test **Zod / helpers** first (pure, fast).
- API tests for auth, fork rules, transition gates, fallback.
- UI tests for Settings confirms, board switcher, Apply/Reject card.
- Manual QA checklist per step before marking the step done.
- Do **not** regress worklogs (time-only) when adding activity.

---

## Unit / package tests (`packages/types` and shared helpers)

| Area             | Cases                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Envelope schema  | Valid multi-workflow; missing default; duplicate workflow ids            |
| Graph            | Self-loop rejected; duplicate `A→B` rejected; `A→B`+`B→A` accepted       |
| Fork             | `forkedFromId` depth > 1 rejected                                        |
| Type bindings    | Overlap across workflows rejected (or documented first-wins — match Zod) |
| Terminal         | State with outbound edges invalid when `terminal: true`                  |
| Escalation       | `requiresEscalation` without preset on an outbound edge rejected         |
| Require children | Enum `off` \| `all_complete` \| `match_parent_target`                    |
| Fallback         | `null` / garbage / wrong shape → seeded default helper                   |
| State bridge     | category from state; legacy status sync; history map optional            |
| Presets          | MVP field types; promote/load id stability                               |

---

## API tests (`apps/api`)

| Area                  | Cases                                                                             |
| --------------------- | --------------------------------------------------------------------------------- |
| Save config           | Manager/admin OK; member 403                                                      |
| Fork                  | Team manager once; second fork 400; non–team-manager 403                          |
| Mark default / delete | Manager OK; cannot delete last/default without replacement rules (define in impl) |
| Transition            | Missing edge 400; `allowAnyOf` deny; allow when matcher hits                      |
| Children A            | Incomplete children block `all_complete` edge                                     |
| Children B            | Mismatch state/category blocks `match_parent_target`                              |
| Lock record           | Non-state fields rejected while in locked state                                   |
| Terminal              | No transition out                                                                 |
| Resolution            | Required preset missing payload → 400; valid → 200 + activity                     |
| Fallback read         | Invalid `workflow_config` returns seeded default to consumers                     |
| Activity              | Transition writes `workflow_transition`; resolution writes snapshot               |
| Charts                | Multi-project category; single-project state dimension                            |

---

## Web tests (`apps/web`)

| Area              | Cases                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Designer Settings | Terminal blocked until outbound removed; Lock record independent |
| Require children  | Control persists on save/reload                                  |
| Board switcher    | Columns/cards follow active workflow; foreign types hidden       |
| DnD               | Optimistic success; API conflict reverts                         |
| Details           | Workflow title shown; state list from item workflow              |
| Resolution dialog | Renders preset; submit sends payload                             |
| Activity tab      | Renders events; empty state                                      |
| Alice card        | Apply calls apply tool only after click; Reject drops proposal   |
| Dirty chat path   | Save then Apply without full navigation mock                     |
| Charts UI         | State label visible only when project selected                   |

---

## Manual QA (per milestone)

### After Step 4 (board + transitions)

1. Open project board → switch workflows → confirm columns and card sets.
2. Drag allowed edge as member; confirm forbidden edge toast/API error.
3. Move parent to done-category edge with **All complete** while child open → blocked.
4. Complete child → parent move succeeds.
5. **Lock record** state: edit title blocked; change state (reopen edge) allowed.
6. **Terminal** state: no outbound in designer; cannot transition out at runtime.
7. Invalid `workflow_config` in DB (staging only) → board shows seeded default.

### After Step 6 (presets)

1. Create named preset (Form + JSON parity).
2. Attach to edge; transition shows dialog; Activity shows snapshot.
3. Load preset on second edge; edit shared preset; both edges use updated form.

### After Step 8 (Alice)

1. Clean designer → ask Alice to add a state → Apply / Reject cards work.
2. Dirty canvas → ask for change → observe save then apply without full reload.
3. Member cannot apply manager-only save (403 / clear message).

### After Step 9 (retire board designer)

1. No Board designer entry under project details.
2. Workflow tab is the only config surface.
3. Chat board-draft path gone or redirected.

---

## User-guide / docs QA

- Manager sees [Workflow designer](../../user-guide/board-and-planning/workflow-designer.md) in `/docs`.
- Member does **not** get designer page when `minimumRole: manager`.
- Kanban, assign-and-status, and chat guides match shipped labels:
  **Lock record in this state**, **Terminal state**, **Require children** options,
  docked Alice Apply/Reject.

---

## Regression watchlist

- Sprint burndown / `done_at` still correct when category is `done`.
- Incomplete-subtasks dialog UX remains understandable.
- Work-log tab unchanged (hours only).
- Jira import still creates items (default state / New bridge).
- Existing board tests updated or removed in Step 9 — not left red.
