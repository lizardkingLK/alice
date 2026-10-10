# Workflow feature documentation

Status: **MVP complete** (Steps 1–11 **Done**; deferred N1–N11 next)

Jira-like **workflow graphs** replace the custom board column designer.
Projects store one or more workflow documents in `projects.workflow_config`.
The kanban board becomes a **per-workflow** view (type / workflow switcher).
Work items carry a single-current **`state`** JSONB placement.

| Document                                                             | Description                                                             | Status                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| [WORKFLOW.md](./WORKFLOW.md)                                         | Product rules, JSON shape, Settings, locks, escalation, data model      | Living (Steps 1–11 as-built) |
| [WORKFLOW_IMPLEMENTATION_PLAN.md](./WORKFLOW_IMPLEMENTATION_PLAN.md) | Atomic development steps (Step 3 split 3a/3b/3c), deferred-next backlog | Steps 1–11 Done; N1–N11 next |
| [WORKFLOW_TESTING.md](./WORKFLOW_TESTING.md)                         | Unit / API / UI test matrix and manual QA                               | Living                       |

## Related

- Board (Kanban runtime; column designer **retired**):
  [../board/](../board/), [CUSTOM_BOARD_DESIGNER.md](../board/CUSTOM_BOARD_DESIGNER.md) (historical)
- Work-item activity (extended for transitions / resolutions):
  [../work-items/ACTIVITY.md](../work-items/ACTIVITY.md)
- Alice chat tools (workflow propose/apply; board draft removed):
  [../chat/AI_CHATBOT.md](../chat/AI_CHATBOT.md)
- User guide:
  [Workflow designer](../../user-guide/board-and-planning/workflow-designer.md),
  [Kanban board](../../user-guide/board-and-planning/kanban-board.md),
  [Assign and status](../../user-guide/work-items/assign-and-status.md),
  [Use AI assistant](../../user-guide/chat/use-ai-assistant.md)

## Intended code homes (when implemented)

| Concern              | Location (planned)                                       |
| -------------------- | -------------------------------------------------------- |
| Zod / shared helpers | `packages/types` (workflow config + transition helpers)  |
| API                  | `apps/api` projects + work-items services                |
| Designer UI          | Project details **Workflow** tab                         |
| Board runtime        | `apps/web/app/board/`                                    |
| Activity             | `activities` table + work-item details tabs              |
| Chat sidebar         | Evolve floating drawer → docked sidebar + workflow tools |
