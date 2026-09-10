# Custom Board Designer

Status: **Plan**

Design document for a **Custom Board Designer** that lets managers define named
kanban columns, map each column to a `WorkItemStatus` value, and attach
per-column validation rules scoped to a team, a role, or an individual user.
Multiple adjacent columns may share the same underlying status. The feature
reuses the JSON-schema conventions and the Alice bot integration already
established by [PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md).

Related:

- Board implementation: `apps/web/app/board/`
- Work-item status: `apps/web/app/work-items/_helpers/work-item-status.ts`
- Shared status enum: `packages/types/src/work-item-status.ts`
- Prisma schema: `packages/db/prisma/schema.prisma` (`projects.workflow_config`)
- Existing JSON schema pattern: [PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md) §4
- RBAC: `apps/web/lib/rbac/roles.ts` + [RBAC_AUTHORIZATION_SKELETON.md](../../auth/RBAC_AUTHORIZATION_SKELETON.md)
- Alice bot: `apps/api/src/routes/api/chat/` + [AI_CHATBOT.md](../chat/AI_CHATBOT.md)
- Feature index: [README.md](./README.md)
- Board defaults (localStorage): `apps/web/app/board/_helpers/board-defaults-storage.ts`

---

## 1. Goals

- Let managers define a custom ordered list of named board columns for a project.
- Map each column to one of the six canonical `WorkItemStatus` values
  (`Draft`, `New`, `ToDo`, `InProgress`, `Testing`, `Done`).
- Allow multiple adjacent columns to share the same status — e.g. three
  separate columns (`Development`, `Code Review`, `Testing`) that all map to
  `InProgress`.
- Attach optional validation rules per column, scoped to a team, a role, or a
  specific user.
- Fall back silently to the default board (one column per non-Draft status) when
  a custom configuration is absent, malformed, or fails to load.
- Store configuration as a versioned JSON document in the existing
  `projects.workflow_config` JSONB column — no new database columns or
  migrations required for v1.
- Reuse the existing Alice bot (`chat.route.data.ts`) to guide users through
  producing a valid configuration in natural language, following the same pattern
  used for dynamic fields.
- Support schema evolution over time through a `schemaVersion` field.

## 2. Non-goals (current)

- Moving work items between columns via an API that understands column identity
  (see §7 for the column-placement problem).
- Enforcing column order through backend business rules; column sequencing is
  display-only in v1.
- Real-time board subscription changes when another user edits the
  configuration.
- Per-sprint board overrides (a single configuration per project in v1).
- UI drag-and-drop column reordering in the designer (text/JSON editing in v1,
  visual builder deferred).

---

## 3. Current Board Behaviour

### 3.1 Column definition

The default board derives its columns from `BOARD_WORK_ITEM_STATUSES`, defined
in `packages/types/src/work-item-status.ts`:

```typescript
export const WORK_ITEM_STATUSES = Constants.public.Enums.WorkItemStatus;
// → ['Draft', 'New', 'ToDo', 'InProgress', 'Testing', 'Done']

export const BOARD_WORK_ITEM_STATUSES = WORK_ITEM_STATUSES.filter(
  (
    status
  ): status is Exclude<WorkItemStatus, typeof WorkItemStatusEnum.Draft> =>
    status !== WorkItemStatusEnum.Draft
);
// → ['New', 'ToDo', 'InProgress', 'Testing', 'Done']
```

`apps/web/app/board/_components/kanban-board.tsx` maps these to rendered columns:

```typescript
const COLUMNS = BOARD_STATUS_COLUMNS;
// [{ id: 'New', accentClassName: '...' }, ...]

{
  COLUMNS.map((column) => {
    const columnItems = filteredItems.filter(
      (item) => item.status === column.id // ← direct 1-to-1 match
    );
    // ...
  });
}
```

**Key observation:** today, `column.id === item.status` always. There is a
strict 1-to-1 relationship between a column and a status value. Custom columns
that share a status break this model (see §7).

### 3.2 Status enum (database)

The Prisma enum `WorkItemStatus` in `packages/db/prisma/schema.prisma`:

```prisma
enum WorkItemStatus {
  Draft
  New
  ToDo
  InProgress
  Testing
  Done
}
```

This enum lives in the database. It cannot be extended without a migration.
Custom column _names_ are display metadata only; they do not expand the enum.

### 3.3 Drag-and-drop status update

When a card is dropped on a column or the "Move to" dialog fires,
`applyStatusChange` calls `updateWorkItemStatus(id, targetStatus, ...)` from
`apps/web/app/work-items/_services/work-items.mutations.client.ts`. The status
written to the database is the column's mapped `WorkItemStatus` value, not the
column name.

### 3.4 Board defaults (workspace preferences)

Users save a preferred project/sprint combination in `localStorage` via
`apps/web/app/board/_helpers/board-defaults-storage.ts` under the key
`alice:board-defaults:{userId}`. This is personal preference, not project
configuration.

### 3.5 Existing project JSON columns

The `projects` table already carries two untyped JSONB columns:

| Column              | Current use                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attributes_config` | Dynamic work-item field definitions (see [PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md))                                         |
| `workflow_config`   | **Not yet used anywhere in application code** (confirmed by code search — present in schema and generated types but never read or written by any route or service) |

`workflow_config` is the intended home for the board configuration document.

---

## 4. The Multiple-Status-Column Problem

### 4.1 Statement of the problem

When multiple columns map to the same status — for example:

| Column label | Mapped status |
| ------------ | ------------- |
| Backlog      | `ToDo`        |
| Ready        | `ToDo`        |
| Development  | `InProgress`  |
| Code Review  | `InProgress`  |
| Testing      | `InProgress`  |
| Done         | `Done`        |

…a work item whose `status = 'InProgress'` cannot be placed into exactly one
column by status matching alone. The board would display it in _all_ columns
that carry `InProgress`, which is wrong.

### 4.2 Does the current data model solve this?

The `work_items` table has no field that records which named column a work item
occupies. The relevant fields are:

| Field           | Type             | Notes                               |
| --------------- | ---------------- | ----------------------------------- |
| `status`        | `WorkItemStatus` | Enum — one of six values            |
| `record_status` | `RecordStatus`   | Lifecycle (`active`, `archived`, …) |
| `done_at`       | `timestamptz?`   | Set when transitioning to `Done`    |

There is **no `board_column_id` or `column_name` field**. The data model does
not currently solve the problem.

### 4.3 Design options

> [!IMPORTANT]
> A product/team decision is required before implementation. The options below
> have meaningfully different trade-offs. Record the chosen option in this
> document and update the Open Questions section accordingly.

#### Option A — Add a `board_column` field to `work_items` (database migration required)

Add an optional `board_column String?` column to `work_items`. When a user
moves a card to a column, the API writes both `status` (the mapped status) and
`board_column` (the column's stable `id` from the configuration).

Pros:

- Precise placement survives page reload.
- No ambiguity when loading the board.

Cons:

- Requires a Prisma migration and a new API field on the PATCH endpoint.
- `board_column` can become stale if the configuration is later edited
  (e.g. a column is renamed or removed). A migration or cleanup job would
  be needed.
- Adds complexity to the work-item write path.

#### Option B — Infer placement from column order (no migration, display heuristic)

When a work item has a status shared by multiple columns, place it in the
_first_ column in the configuration that carries that status. On drag-and-drop,
update `status` only; placement within same-status columns is not persisted.

Pros:

- No migration.
- Simple to implement.

Cons:

- Placement within a group of same-status columns is lost on reload.
- Moving a card from `Development` to `Code Review` (both `InProgress`) does
  not write any data — the card reappears in `Development` on refresh.
- Users may expect finer progress tracking between same-status columns.

#### Option C — Introduce a `custom_fields` JSONB column on `work_items`

Leverage the upcoming dynamic fields system (see [PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md))
to store `columnId` as a project-defined dynamic field.

Pros:

- Reuses a forthcoming system; no separate migration.

Cons:

- Couples board configuration to the dynamic fields schema.
- Dynamic fields are work-item metadata, not workflow state; mixing concerns
  increases complexity.
- Still requires the dynamic-fields migration before this feature can ship.

> **Recommended default for v1: Option B**, with a clear note in the UI that
> within a same-status group, card placement is not persisted. Ship Option A
> or C in a subsequent phase once the team reaches alignment.

---

## 5. Proposed Board Configuration JSON Schema

The configuration is stored in `projects.workflow_config` as a versioned JSON
document.

> [!NOTE]
> The structure below is a **proposal**. It must be reviewed by the team before
> implementation. All field names, constraints, and defaults are subject to change.

### 5.1 Top-level shape (proposed)

```json
{
  "$schema": "https://alice.internal/schemas/board-config/v1",
  "schemaVersion": 1,
  "columns": [
    {
      "id": "backlog",
      "label": "Backlog",
      "status": "ToDo",
      "position": 0,
      "validationRules": []
    },
    {
      "id": "ready",
      "label": "Ready for Dev",
      "status": "ToDo",
      "position": 1,
      "validationRules": []
    },
    {
      "id": "development",
      "label": "Development",
      "status": "InProgress",
      "position": 2,
      "validationRules": [
        {
          "id": "dev-team-only",
          "scope": "team",
          "teamId": "uuid-of-dev-team",
          "description": "Only the Development team may move cards into this column"
        }
      ]
    },
    {
      "id": "code-review",
      "label": "Code Review",
      "status": "InProgress",
      "position": 3,
      "validationRules": []
    },
    {
      "id": "done",
      "label": "Done",
      "status": "Done",
      "position": 4,
      "validationRules": []
    }
  ]
}
```

### 5.2 Column object fields (proposed)

| Field             | Type               | Required | Notes                                                                                                               |
| ----------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`              | `string`           | Yes      | Stable identifier (`^[a-z0-9-]+$`). Must be unique within the config.                                               |
| `label`           | `string`           | Yes      | Display name shown as the column header (1–60 characters).                                                          |
| `status`          | `WorkItemStatus`   | Yes      | One of `New \| ToDo \| InProgress \| Testing \| Done`. `Draft` is excluded (Draft items are hidden from the board). |
| `position`        | `number`           | Yes      | Integer ≥ 0. Columns are rendered in ascending position order.                                                      |
| `validationRules` | `ValidationRule[]` | No       | Empty array if no rules apply.                                                                                      |

> [!IMPORTANT]
> At least one column must map to each status value already held by existing
> work items. The schema validator should warn (not block) if a status is
> uncovered, to avoid data loss scenarios where existing items become invisible.

### 5.3 ValidationRule object fields (proposed)

A validation rule restricts **who may move a card into this column**. The scope
field controls which identity dimension is checked.

| Field         | Type                               | Required              | Notes                                       |
| ------------- | ---------------------------------- | --------------------- | ------------------------------------------- |
| `id`          | `string`                           | Yes                   | Stable rule identifier.                     |
| `scope`       | `"team" \| "role" \| "user"`       | Yes                   | Dimension to match against.                 |
| `teamId`      | `string (UUID)`                    | When `scope = "team"` | References `teams.id`.                      |
| `role`        | `"admin" \| "manager" \| "member"` | When `scope = "role"` | Matches `users.role`.                       |
| `userId`      | `string (UUID)`                    | When `scope = "user"` | References `users.id`.                      |
| `description` | `string`                           | No                    | Human-readable explanation shown in the UI. |

Multiple rules on the same column are evaluated with **OR** semantics: a user
who satisfies **any** rule may move a card there. An empty `validationRules`
array means the column is unrestricted.

### 5.4 Schema versioning

The `schemaVersion` integer field enables forward-compatible evolution:

| Version | Meaning                                                         |
| ------- | --------------------------------------------------------------- |
| `1`     | Initial schema (columns + validationRules)                      |
| Future  | New fields added at the top level or inside column/rule objects |

When the API loads a configuration, it checks `schemaVersion`. An unknown
version causes the board to fall back to the default layout (see §8) and
surfaces an admin-only warning.

### 5.5 Proposed Zod meta-schema

This follows the same Zod pattern used by `ProjectFieldsConfigSchema` in
[PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md) §5.2 and
`workItemCoreObject` in `packages/types/src/api/v1/work-items.ts`.

```typescript
// packages/types/src/api/v1/board-config.ts  [PROPOSED — do not ship yet]

import { z } from 'zod';
import { BOARD_WORK_ITEM_STATUSES } from '../../work-item-status.js';

const boardColumnIdSchema = z
  .string()
  .regex(
    /^[a-z0-9-]+$/,
    'Column id must be lowercase letters, numbers, or hyphens'
  );

const validationRuleSchema = z.discriminatedUnion('scope', [
  z.object({
    id: z.string().min(1),
    scope: z.literal('team'),
    teamId: z.uuid(),
    description: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    scope: z.literal('role'),
    role: z.enum(['admin', 'manager', 'member']),
    description: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    scope: z.literal('user'),
    userId: z.uuid(),
    description: z.string().optional(),
  }),
]);

const boardColumnSchema = z.object({
  id: boardColumnIdSchema,
  label: z.string().min(1).max(60),
  status: z.enum(BOARD_WORK_ITEM_STATUSES),
  position: z.number().int().min(0),
  validationRules: z.array(validationRuleSchema).default([]),
});

export const boardConfigSchema = z.object({
  $schema: z.string().optional(),
  schemaVersion: z.literal(1),
  columns: z
    .array(boardColumnSchema)
    .min(1, 'At least one column is required')
    .refine(
      (cols) => new Set(cols.map((c) => c.id)).size === cols.length,
      'Column ids must be unique'
    ),
});

export type BoardConfig = z.infer<typeof boardConfigSchema>;
export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type BoardValidationRule = z.infer<typeof validationRuleSchema>;
```

---

## 6. Designer Location: Boards View vs Project Details

> [!IMPORTANT]
> The product team needs to decide where the designer surface lives. Both
> options are viable; the decision affects navigation design and which existing
> component is extended.

### Option A — Project Details view (`/projects/[id]?tab=board`)

Add a new `board` tab to the Project Details sidebar introduced in
[PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md) §2.1.

Alignment:

- Follows the established `Fields` tab pattern for project-level configuration.
- RBAC is already enforced at the project workspace level.
- Managers visit `/projects/[id]` for all project configuration tasks.

Impact on `parseProjectDetailsTab` in `apps/web/lib/search-params.ts`:

```typescript
export type ProjectDetailsTab =
  | 'details'
  | 'members'
  | 'teams'
  | 'work-items'
  | 'integrations'
  | 'fields'
  | 'board';
```

### Option B — Board view (`/board`)

Add a **"Customize Board"** action to the board toolbar. A slide-over or full
dialog opens the designer without leaving the board.

Alignment:

- Contextual — users see the board while configuring it.

Impact:

- Requires a new drawer component on `/board`.
- The board currently uses `projectFilter` from URL params; the designer needs
  to know which project is selected, adding complexity when "All Projects" is
  active.

### Option C — Both surfaces (deferred)

Read-only configuration summary on the Board view (with a deep link to edit)
and the full editor in Project Details. Deferred to a later iteration.

---

## 7. Column Placement Data Flow

### 7.1 Board load

```text
BoardData (RSC)
  → safeServerFetch(getWorkItems(...))     ← existing read; returns items with status
  → safeServerFetch(getProjectWorkspace)  ← returns project row including workflow_config
  → boardConfigSchema.safeParse(workflow_config)
  → if parse fails → fall back to BOARD_WORK_ITEM_STATUSES default columns
  → pass { workItems, boardColumns } to KanbanBoard (client component)
```

### 7.2 Column item assignment (client, proposed)

```typescript
function assignItemsToColumns(
  items: DbWorkItem[],
  columns: BoardColumn[]
): Map<string, DbWorkItem[]> {
  const result = new Map(columns.map((col) => [col.id, [] as DbWorkItem[]]));
  const sorted = [...columns].sort((a, b) => a.position - b.position);

  for (const item of items) {
    if (item.status === 'Draft') continue;
    // First-match heuristic (Option B from §4.3)
    const col = sorted.find((c) => c.status === item.status);
    if (col) result.get(col.id)?.push(item);
  }

  return result;
}
```

This replaces the current `filteredItems.filter(item => item.status === column.id)`
in `kanban-board.tsx` line 541–543.

### 7.3 Status update on drag-and-drop

When a card is dragged to column `C` whose `status` is `S`, the existing
`updateWorkItemStatus(id, S, updated_at)` call is reused unchanged. The column
name is not written to the database in v1 (Option B from §4.3).

### 7.4 Move-to dialog

The "Move to" buttons (kanban-board.tsx lines 722–741) currently iterate
`COLUMNS`. They should iterate the resolved `boardColumns` array, displaying
each named column label. Clicking a button writes the column's mapped `status`.

---

## 8. Default Board Fallback

The fallback must be silent and non-destructive.

Fallback triggers:

1. `projects.workflow_config` is `null` — no configuration set yet.
2. `boardConfigSchema.safeParse(workflow_config)` returns `success: false`.
3. `schemaVersion` is not a supported value.
4. Network or server error when loading the project record.

Fallback behaviour:

- Render the existing `BOARD_STATUS_COLUMNS` (one column per non-Draft status).
- Do **not** show an error banner to end-users.
- Show an admin-only informational notice ("Custom board configuration could not
  be loaded; using defaults") when case 2 or 3 applies to a manager or admin.
- Log parse errors server-side using the existing error logging convention.

This mirrors the `SafeDynamicFieldsSection` fallback pattern documented in
[PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md) §6.3.

---

## 9. Validation Rules: Team, Role, and Individual Scope

### 9.1 What validation rules are

A validation rule on a column restricts who may **drop a card into that column**
or select it from the "Move to" dialog. It does not prevent the user from
viewing the card or moving it to other columns.

Enforcement is applied at two layers:

- **Client-side**: disable the drop target and show a tooltip when the current
  user does not satisfy any rule on the column.
- **Server-side**: the `PATCH /api/v1/workItems/:id/status` handler checks the
  validation rules stored in the project's board configuration before updating
  the status field.

### 9.2 Mapping to existing identity primitives

| Rule scope | Alice entity | Existing model                                                  |
| ---------- | ------------ | --------------------------------------------------------------- |
| `team`     | `teams.id`   | `teams` + `team_members` in `packages/db/prisma/schema.prisma`  |
| `role`     | `users.role` | `UserRole` enum (`admin \| manager \| member`) in `users` table |
| `user`     | `users.id`   | Direct FK into `users` table                                    |

The API resolves all three dimensions on every authenticated request via
`requireApiAuth` (attaches `userId`) and the database role in `public.users`.
Team membership is queryable from `team_members` filtered by `user_id` and
`status = 'active'`.

### 9.3 What does not exist today

There is no concept of "workflow transition rules" or "column move permissions"
in the current API. The `workItems.service.ts` does not consult `workflow_config`.
The closest analogue is sprint/member capacity validation in `workItems.service.ts`
(see [ALLOCATION_VALIDATION.md](../work-items/ALLOCATION_VALIDATION.md)), which
returns a `WorkItemValidationError` (400) when capacity is exceeded. The same
error type and pattern would be reused for column validation.

### 9.4 Proposed enforcement pattern (server)

```typescript
// apps/api/src/routes/api/workItems/workItems.service.ts  [proposed addition]

async function assertColumnMovePermitted(
  boardConfig: BoardConfig,
  targetStatus: WorkItemStatus,
  requestingUserId: string,
  db: PrismaClient
): Promise<void> {
  const targetColumns = boardConfig.columns.filter(
    (col) => col.status === targetStatus
  );

  for (const col of targetColumns) {
    if (col.validationRules.length === 0) continue;

    const user = await db.users.findUniqueOrThrow({
      where: { id: requestingUserId },
      select: { role: true },
    });

    const allowed = await col.validationRules.reduce<Promise<boolean>>(
      async (acc, rule) => {
        if (await acc) return true;
        if (rule.scope === 'role') return rule.role === user.role;
        if (rule.scope === 'user') return rule.userId === requestingUserId;
        if (rule.scope === 'team') {
          const membership = await db.team_members.findFirst({
            where: {
              team_id: rule.teamId,
              user_id: requestingUserId,
              status: 'active',
            },
          });
          return membership !== null;
        }
        return false;
      },
      Promise.resolve(false)
    );

    if (!allowed) {
      throw new WorkItemValidationError(
        `You do not have permission to move items into the "${col.label}" column.`
      );
    }
  }
}
```

> [!NOTE]
> This is a **proposed** pattern. The final implementation must align with the
> layering conventions in `workItems.service.ts` and error types in
> `workItems.errors.ts`.

### 9.5 Open items for validation rules (product decision needed)

See §14 (Open Questions) items 3–6.

---

## 10. Storage and Persistence

### 10.1 Chosen column: `projects.workflow_config`

`projects.workflow_config` is a nullable JSONB column present in the Prisma
schema and generated types (`packages/types/src/generated/supabase/database.types.ts`
line 656) but **unused by any application code**. It is the natural home for
board configuration without any migration.

```prisma
model projects {
  // ...
  workflow_config   Json?   // ← stores the BoardConfig document
  // ...
}
```

> [!NOTE]
> No migration is required for v1. If the team later needs a dedicated
> `board_config` column, an additive migration would be low-risk.

### 10.2 Write path (API)

Proposed new endpoint:

```
PUT  /api/v1/projects/:id/board-config
```

Alternatively, extend `PUT /api/projects/:id` to accept an optional
`workflow_config` field validated by `boardConfigSchema`, following the same
pattern as `attributes_config` in `projects.repository.ts` (lines 81–82).

### 10.3 Read path

`projectListSelect` and `projectDetailSelect` in
`packages/types/src/api/v1/projects.ts` do not currently include
`workflow_config`. Both would need extending for the board-data RSC to receive
the configuration.

---

## 11. Alice Bot Integration

### 11.1 Existing bot capability

The Alice bot (`chat.route.data.ts`) uses Gemini function calling to produce
structured data. It already generates JSON Schemas for dynamic fields by
following the `systemInstruction` and has a `parse_work_item_attachment` tool
that can parse JSON documents. The same infrastructure supports board
configuration generation.

### 11.2 Proposed bot flow for board configuration

1. Manager opens the **Board designer** surface.
2. Manager clicks **"Set up with Alice"** — opens the Alice drawer
   (`floating-chat-widget.tsx`).
3. Manager describes the desired workflow in natural language:
   > _"I want columns: Backlog, Ready, In Dev, Code Review, QA, and Done.
   > Only the QA team should be able to move things into QA."_
4. Alice calls a new `configure_board` tool (or generates the JSON inline).
5. The generated `BoardConfig` JSON is loaded into the designer editor.
6. The manager reviews, edits if needed, and clicks **"Validate & Save"**.
7. The save action runs `boardConfigSchema.safeParse(...)` before calling the
   API — the bot does not write directly to the database.

### 11.3 Proposed `configure_board` tool declaration

```typescript
// apps/api/src/routes/api/chat/chat.route.data.ts  [proposed addition]
{
  name: 'configure_board',
  description:
    'Generate a custom board configuration for a project from a natural language description. Returns a BoardConfig JSON document for the user to review before saving.',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'UUID of the project.' },
      columns: {
        type: 'array',
        description: 'Ordered list of board columns.',
        items: {
          type: 'object',
          properties: {
            id:    { type: 'string', description: 'Stable lowercase slug, e.g. "code-review".' },
            label: { type: 'string', description: 'Display name, e.g. "Code Review".' },
            status: {
              type: 'string',
              enum: ['New', 'ToDo', 'InProgress', 'Testing', 'Done'],
              description: 'Canonical WorkItemStatus value this column maps to.',
            },
            position: { type: 'number', description: 'Zero-based render order.' },
            validationRules: {
              type: 'array',
              items: { type: 'object' },
              description: 'Optional move restrictions (team/role/user scoped).',
            },
          },
          required: ['id', 'label', 'status', 'position'],
        },
      },
    },
    required: ['projectId', 'columns'],
  },
}
```

This follows existing tool declaration conventions in `chat.route.data.ts`.

### 11.4 Safety constraint

The same constraint as [PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md) §8.2 applies:

> The Alice bot does **not** bypass validation or write directly to the database.
> All AI-generated output flows through the same `boardConfigSchema.safeParse`
> pipeline as manual edits.

---

## 12. RBAC and Permissions

### 12.1 Who can configure the board

Permissions are checked using `isManagerOrAdmin(role)` from
`apps/web/lib/rbac/roles.ts`, following the same pattern as the Fields tab in
[PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md) §7.

| Role        | View custom board | Configure (edit/save)   | Bypass column validation rules |
| ----------- | ----------------- | ----------------------- | ------------------------------ |
| **Admin**   | Yes               | Yes                     | Open question (see §14 item 3) |
| **Manager** | Yes               | Yes (own projects only) | Open question                  |
| **Member**  | Yes               | No                      | No                             |

### 12.2 Who can move cards

If a column has validation rules, only users who satisfy at least one rule may
drop a card there. All roles can move cards to unrestricted columns.

### 12.3 Guest users

Guest users follow the project ACL in
[ACCESS_ALLOWLIST.md](../access/ACCESS_ALLOWLIST.md). If a guest has access to
a project, they see its custom board. Validation rules apply equally to guests.

---

## 13. Error Handling

| Scenario                                               | Behaviour                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `workflow_config` is `null`                            | Board renders with default columns silently                                        |
| `boardConfigSchema.safeParse` returns `success: false` | Fall back to defaults; show admin-only warning in the designer tab                 |
| Unknown `schemaVersion`                                | Fall back to defaults; surface version mismatch warning for managers               |
| API save returns 400 (invalid body)                    | Show inline editor error; do not clear the draft                                   |
| API save returns 403 (insufficient role)               | Show permission error toast                                                        |
| Validation rule blocks a drag-and-drop                 | Prevent drop; show tooltip with `rule.description` or generic message              |
| Bot generates invalid JSON                             | `boardConfigSchema.safeParse` catches it; error shown in editor; not written to DB |

---

## 14. Open Questions

> [!IMPORTANT]
> The following must be resolved with the team lead and product owner before
> implementation begins.

1. **Column placement persistence (§4.3):** Which option — A (new `board_column`
   DB field and migration), B (first-match heuristic, no migration), or C
   (dynamic fields piggyback)?

2. **Designer location (§6):** Project Details sidebar tab, Board view drawer,
   or both?

3. **Admin bypass:** Should admins always bypass column validation rules, or
   are they subject to the same rules as managers?

4. **Validation rule semantics:** Block the move hard (400 from the API) or
   warn and require confirmation (soft block) before the status is written?

5. **Draft status in columns:** Should the designer allow mapping a column to
   `Draft`? Currently `Draft` items are excluded from the board at the read
   layer (`boardItems = workItems.filter(item => item.status !== 'Draft')`).

6. **Missing status coverage:** If a custom configuration defines no column for
   `New`, what happens to items whose `status` is `New`? Block save, warn only,
   or silently ignore them?

7. **Configuration scope:** One board config per project (proposed) or allow
   different configs per sprint?

8. **Bot tool approach:** Dedicated `configure_board` function-calling tool
   (proposed) or use the existing `parse_work_item_attachment` flow with a JSON
   template?

9. **Column ID stability:** User-supplied slug (readable, risk of collision) or
   server-generated UUID (opaque)?

10. **Validation rule OR vs AND:** Multiple rules on one column — OR (user
    satisfies any, proposed) or AND (user satisfies all)?

---

## 15. Relevant Existing Files

### Backend / API

| File                                                      | Relevance                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/api/src/routes/api/workItems/workItems.service.ts`  | Add column-move permission check before the status PATCH                 |
| `apps/api/src/routes/api/workItems/workItems.route.ts`    | Wire any new validation into the route handler                           |
| `apps/api/src/routes/api/workItems/workItems.errors.ts`   | `WorkItemValidationError` — reuse for permission denial (400)            |
| `apps/api/src/routes/api/projects/projects.route.ts`      | Extend or add an endpoint to save `workflow_config`                      |
| `apps/api/src/routes/api/projects/projects.repository.ts` | `patch.attributes_config` pattern (lines 81–82) shows how to write JSONB |
| `apps/api/src/routes/api/chat/chat.route.data.ts`         | Add `configure_board` tool declaration                                   |
| `apps/api/src/routes/api/chat/chat.service.ts`            | Wire the new tool to its handler                                         |

### Shared types / schemas

| File                                      | Relevance                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `packages/types/src/work-item-status.ts`  | `BOARD_WORK_ITEM_STATUSES` — the valid status values for column mapping |
| `packages/types/src/api/v1/projects.ts`   | `projectListSelect` / `projectDetailSelect` — add `workflow_config`     |
| `packages/types/src/api/v1/work-items.ts` | `jsonSchema`, `workItemStatusSchema` — reuse Zod patterns               |
| `packages/db/prisma/schema.prisma`        | `projects.workflow_config Json?` — storage column, no migration needed  |

### Frontend / web

| File                                                                   | Relevance                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/web/app/board/_components/kanban-board.tsx`                      | Replace `COLUMNS` constant with resolved `boardColumns`; update column render and drop handlers |
| `apps/web/app/board/_components/board-data.tsx`                        | Fetch `workflow_config`; parse and pass to `KanbanBoard`                                        |
| `apps/web/app/work-items/_helpers/work-item-status.ts`                 | `BOARD_STATUS_COLUMNS` — replaced by dynamic column list when config is active                  |
| `apps/web/lib/search-params.ts`                                        | Extend `ProjectDetailsTab` if designer lives in Project Details                                 |
| `apps/web/app/projects/[id]/_components/project-details-workspace.tsx` | Add `board` tab to sidebar (if Option A of §6 is chosen)                                        |
| `apps/web/app/board/_helpers/board-defaults-storage.ts`                | Personal workspace preferences — unchanged, coexists with project config                        |

---

## 16. Implementation Stages (Suggested)

**Stage 1 — Schema and storage (no UI)**

- Define `boardConfigSchema` Zod type in `packages/types/src/api/v1/board-config.ts`.
- Extend `projectDetailSelect` to include `workflow_config`.
- Extend `PUT /api/projects/:id` (or add a new endpoint) to accept and validate `workflow_config`.
- Write unit tests for `boardConfigSchema` (valid, invalid JSON, wrong version).

**Stage 2 — Default fallback in the board**

- Update `board-data.tsx` to parse `workflow_config` via `boardConfigSchema.safeParse`.
- Pass resolved columns to `KanbanBoard`.
- Update column render and drop handlers to use dynamic columns.
- Verify default fallback works when config is absent or parse fails.
- Write unit tests for the `assignItemsToColumns` function.

**Stage 3 — Designer UI**

- Create `BoardDesignerWorkspace` component (JSON editor + column preview panel).
- Add the designer surface to the chosen location (Project Details tab or Board drawer).
- Wire "Validate & Save" to the API endpoint.

**Stage 4 — Validation rules**

- Add `assertColumnMovePermitted` to `workItems.service.ts`.
- Enforce rules client-side: disable drop targets, show permission tooltips.
- Write tests for rule-gated drag-and-drop (team, role, user scopes).

**Stage 5 — Alice bot integration**

- Add `configure_board` tool to `chat.route.data.ts`.
- Wire the tool handler in `chat.service.ts`.
- Update `systemInstruction` to describe the board configuration workflow.
- Test end-to-end bot → generated JSON → validate & save flow.

**Stage 6 — Column placement (after §4.3 decision)**

- Implement the chosen option (Option A migration, B heuristic, or C dynamic fields).

---

## 17. Testing Strategy

| Scope                 | What to test                                                                                                 | Location                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **Schema validation** | Valid configs, missing required fields, unknown `schemaVersion`, duplicate column ids, invalid status values | `packages/types` unit tests (Vitest) |
| **Column assignment** | Items assigned to correct columns, same-status items go to first matching column, Draft items excluded       | `apps/web/tests/board/`              |
| **Fallback**          | Null config, parse failure, version mismatch all render default columns                                      | `apps/web/tests/board/`              |
| **Validation rules**  | Team / role / user scope — allowed and denied paths                                                          | `apps/api/tests/workItems/`          |
| **API save**          | Valid body persists; invalid body returns 400; unauthorized returns 403                                      | `apps/api/tests/projects/`           |
| **Bot integration**   | `configure_board` tool returns a valid `BoardConfig` shape                                                   | `apps/api/tests/chat/`               |
| **Designer UI**       | JSON editor accepts/rejects on validate; save disabled when schema is invalid                                | `apps/web/tests/board/`              |

Run all tests with:

```powershell
pnpm --filter api test
pnpm --filter web test
```

Follow the conventions in `.cursor/rules/08-qa-dev-manager.mdc` when adding
coverage.
