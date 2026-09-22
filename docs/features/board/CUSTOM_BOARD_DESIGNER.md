# Custom Board Designer

Status: **Implemented through Stage 5**

Design document for a **Custom Board Designer** that lets managers define named
kanban columns, map each column to a `WorkItemStatus` value, and attach
source-to-destination movement rules scoped to a team, a role, or an individual
user.
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
- Attach optional movement rules to an exact source/destination column pair,
  scoped to a team, a role, or a specific user.
- Fall back silently to the default board (one column per non-Draft status) when
  a custom configuration is absent, malformed, or fails to load.
- Store configuration as a versioned JSON document in the existing
  `projects.workflow_config` JSONB column — no new database columns or
  migrations required for v1.
- Preserve version-1 column-only documents while introducing version-2
  transition rules.

## 2. Non-goals (current)

- Client-side pre-evaluation of movement rules. The API is authoritative and the
  board rolls an optimistic move back when it returns a policy denial.
- Real-time board subscription changes when another user edits the
  configuration.
- Per-sprint board overrides (a single configuration per project).
- Direct or autonomous Alice bot saving of board configurations. Alice creates
  reviewable drafts only.

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

The default configuration still uses status-shaped column IDs, but custom
boards do not require `column.id === item.status`. Placement is resolved from
`work_items.board_column_id`, with the first column for the item's status used
as a compatibility fallback when that value is null or stale.

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
`applyStatusChange` calls `updateWorkItemStatus` with both the destination
status and destination `board_column_id`. The API persists both fields in the
same work-item update.

### 3.4 Board defaults (workspace preferences)

Users save a preferred project/sprint combination in `localStorage` via
`apps/web/app/board/_helpers/board-defaults-storage.ts` under the key
`alice:board-defaults:{userId}`. This is personal preference, not project
configuration.

### 3.5 Existing project JSON columns

The `projects` table already carries two untyped JSONB columns:

| Column              | Current use                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `attributes_config` | Dynamic work-item field definitions (see [PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md](./PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md)) |
| `workflow_config`   | Stores the validated versioned custom board configuration.                                                                 |

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

The Stage 2 migration added the field that records which named column a work
item occupies. The relevant fields are:

| Field             | Type             | Notes                                                       |
| ----------------- | ---------------- | ----------------------------------------------------------- |
| `status`          | `WorkItemStatus` | Canonical status mapped by the selected board column        |
| `board_column_id` | `String?`        | Stable column ID; null and stale values use status fallback |
| `record_status`   | `RecordStatus`   | Lifecycle (`active`, `archived`, …)                         |
| `done_at`         | `timestamptz?`   | Set when transitioning to `Done`                            |

There is intentionally no `column_name` field; names remain configuration
metadata. `board_column_id` is the persisted placement identity.

### 4.3 Design options

> [!NOTE]
> Option A was selected and shipped in Stage 2. Options B and C below are kept
> only as the original decision record.

#### Option A — Add `board_column_id` to `work_items` (selected and implemented)

Add an optional `board_column_id String?` column to `work_items`. When a user
moves a card to a column, the API writes both `status` (the mapped status) and
`board_column_id` (the column's stable `id` from the configuration).

Pros:

- Precise placement survives page reload.
- No ambiguity when loading the board.

Cons:

- Requires a Prisma migration and a new API field on the PATCH endpoint.
- `board_column_id` can become stale if the configuration is later edited.
  Runtime resolution safely falls back to the first matching status column.
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

> **Decision:** Option A shipped. Placement within same-status groups persists
> across reloads through `board_column_id`.

---

## 5. Board Configuration JSON Schema

The configuration is stored in `projects.workflow_config` as a versioned JSON
document.

### 5.1 As-built schema (authoritative)

Version identifiers are strings. Version 1 remains valid and unchanged:

```json
{
  "version": "1",
  "columns": [
    { "id": "new", "name": "New", "status": "New" },
    { "id": "todo", "name": "To Do", "status": "ToDo" },
    { "id": "development", "name": "Development", "status": "InProgress" },
    { "id": "testing", "name": "Testing", "status": "Testing" },
    { "id": "done", "name": "Done", "status": "Done" }
  ]
}
```

Version 2 adds transition rules while retaining the same column shape:

```json
{
  "version": "2",
  "columns": [
    { "id": "new", "name": "New", "status": "New" },
    { "id": "todo", "name": "To Do", "status": "ToDo" },
    { "id": "development", "name": "Development", "status": "InProgress" },
    { "id": "code-review", "name": "Code Review", "status": "InProgress" },
    { "id": "testing", "name": "Testing", "status": "Testing" },
    { "id": "done", "name": "Done", "status": "Done" }
  ],
  "transitions": [
    {
      "fromColumnId": "development",
      "toColumnId": "code-review",
      "allowAnyOf": [
        { "scope": "role", "role": "manager" },
        { "scope": "team", "teamId": "00000000-0000-4000-8000-000000000001" },
        { "scope": "user", "userId": "00000000-0000-4000-8000-000000000002" }
      ]
    }
  ]
}
```

The shared Zod schemas live in
`packages/types/src/api/v1/board-config.ts`. They enforce:

- at least one column and a column for every non-Draft board status;
- unique column IDs;
- column array order is display order; there is no persisted `position` field;
- version 1 has only `version` and `columns` and normalizes to no rules at
  runtime;
- version 2 transition endpoints reference existing, distinct columns;
- only one transition entry exists per source/destination pair;
- `allowAnyOf` is non-empty and contains no duplicate matchers;
- role matchers use the exact `member`, `manager`, and `admin` enum values, and
  team/user IDs are UUIDs.

An absent source/destination pair means unrestricted. A present transition is
allowed when any matcher succeeds.

### 5.2 Historical pre-implementation proposal (superseded)

> [!NOTE]
> The remainder of this section records the original proposal. Its
> `schemaVersion`, `label`, `position`, and per-column `validationRules` fields
> were superseded by the authoritative schema above.

#### Historical top-level shape

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

#### Historical column object fields

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

#### Historical ValidationRule object fields

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

#### Historical schema versioning

The `schemaVersion` integer field enables forward-compatible evolution:

| Version | Meaning                                                         |
| ------- | --------------------------------------------------------------- |
| `1`     | Initial schema (columns + validationRules)                      |
| Future  | New fields added at the top level or inside column/rule objects |

When the API loads a configuration, it checks `schemaVersion`. An unknown
version causes the board to fall back to the default layout (see §8) and
surfaces an admin-only warning.

#### Historical Zod meta-schema

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

### 7.2 Column item assignment

`resolveBoardSourceColumn` in the shared board-config module is the canonical
resolver used by both the web board and API policy evaluation. It accepts an
exact `board_column_id` only when that column exists and its mapped status
matches the work item's status. A null, removed, or mismatched ID falls back to
the first configured column with the same status. This keeps legacy and stale
placements visible and gives the API a deterministic source column.

The original first-status-only sketch is retained below for historical context;
the shipped resolver checks `board_column_id` first.

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

### 7.3 Status and placement update on drag-and-drop

When a card is dragged to column `C` whose status is `S`,
`updateWorkItemStatus` sends `status = S` and `board_column_id = C.id`. The
optimistic client state updates both values and restores both if the mutation
fails.

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
3. `version` is not a supported value.
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

A movement rule restricts one exact **source column → destination column**
transition. It does not prevent the user from viewing the card or taking an
unconfigured transition.

The backend `WorkItemService.updateWorkItem` path is authoritative. The client
continues to allow optimistic drag/drop and Move-to interactions; on a denial
it restores both status and placement and shows a source/destination-specific
toast.

### 9.2 Mapping to existing identity primitives

| Rule scope | Alice entity | Existing model                                                  |
| ---------- | ------------ | --------------------------------------------------------------- |
| `team`     | `teams.id`   | `teams` + `team_members` in `packages/db/prisma/schema.prisma`  |
| `role`     | `users.role` | `UserRole` enum (`admin \| manager \| member`) in `users` table |
| `user`     | `users.id`   | Direct FK into `users` table                                    |

The evaluator loads the actor's exact database role plus active project and
team memberships. Team matches require an active membership in an active team
belonging to the work item's project. User matches require the actor ID to
match and the actor to be an active project member. Stale/deleted/inactive IDs
therefore do not match.

### 9.3 As-built evaluator semantics

1. If status and `board_column_id` did not change, no movement policy is
   evaluated.
2. Resolve the source from the current stored placement, falling back by status
   for null or stale IDs.
3. Resolve the destination from the requested `board_column_id`. A null ID,
   used by All Projects status-only moves, resolves to the first matching status
   column; it does not bypass policy.
4. Look up the exact source/destination pair. No entry means unrestricted.
5. For a configured entry, allow when any `allowAnyOf` matcher succeeds. Roles
   are exact—`admin` has no implicit bypass.
6. If no matcher succeeds, return HTTP 403 with the stable machine code
   `BOARD_MOVE_FORBIDDEN` and no sensitive matcher details.

Version-1 documents normalize to an empty transition list, so all existing v1
boards retain their behavior. Invalid explicit column IDs remain validation
errors rather than being silently redirected.

### 9.4 Historical enforcement sketch (superseded)

```typescript
// Historical proposal only; see workItems.service.ts for the shipped evaluator.

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
> This sketch used destination-wide rules and a 400 validation error. It is
> retained only as design history; Stage 4 shipped transition-pair rules and a
> stable 403 policy error.

### 9.5 Designer behavior

The project Board tab exposes a Movement rules action for each source column.
Managers choose a destination and either Everyone (removes the pair rule) or
Restricted. Restricted rules can combine role, active project-team, and active
project-member matchers; the helper text states their OR semantics. Saving a
rule upgrades the draft to version 2. Merely opening the dialog or editing
columns on a v1 board does not rewrite the persisted version.

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

### 11.1 Implemented tool flow

Stage 5 reuses the existing provider-agnostic Alice chat loop:

```text
ChatClient → POST /api/v1/chat → ChatService → provider tool calling
  → executeTool() → toolActionsPerformed → ChatExecutedActionCard
```

For board requests Alice resolves the typed project, calls
`list_board_entities`, clarifies duplicate person or team names, and then calls
`configure_board_draft`. The entity tool returns only the current valid board,
active teams belonging to that project, active project members, and basic
project information after the existing project-access check passes.

### 11.2 Stable references and validation

Existing columns are referenced only by IDs from the current `BoardConfig`;
display names are never used as identities. New columns use temporary keys in
the provider tool call. The server replaces each temporary key with
`crypto.randomUUID()`, resolves transition references, and ensures no temporary
key reaches the resulting document.

The server then runs `boardConfigSchema.safeParse`. Invalid configs, unknown
existing column IDs, and inactive or out-of-project team/user IDs return useful
tool errors and emit no action. Existing version-2 rules are preserved when a
request does not modify transitions. Version 1 remains in use for column-only
boards; rules require version 2, and existing version-2 boards remain version 2.

### 11.3 Draft handoff and save boundary

A valid result emits a `configure_board` action containing only `projectId`,
`projectName`, and the validated config. The action card writes the config to
`sessionStorage["board_draft_${projectId}"]` and opens
`/projects/${projectId}?tab=board`.

Board Designer validates the session value again, consumes it, retains the
persisted configuration as its baseline, marks the generated config dirty, and
shows **Draft generated by Alice**. The user must still click Save. If the
draft omits a persisted column, the designer requires deletion confirmation
before saving. The bot never mutates work items or column placements.

The only persistence path remains:

```text
Board Designer → updateProject → PUT /api/projects/:id
  → requireProjectManager → ProjectsRepository → workflow_config
```

Managers and administrators may receive a structured draft. Members may
receive conversational suggestions only and retain a read-only Board Designer.
The bot role check protects UX; `requireProjectManager` remains the security
boundary for persistence.

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

| Scenario                                               | Behaviour                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `workflow_config` is `null`                            | Board renders with default columns silently                                                           |
| `boardConfigSchema.safeParse` returns `success: false` | Fall back to defaults; show admin-only warning in the designer tab                                    |
| Unknown `version`                                      | Fall back to defaults; surface version mismatch warning for managers                                  |
| API save returns 400 (invalid body)                    | Show inline editor error; do not clear the draft                                                      |
| API save returns 403 (insufficient role)               | Show permission error toast                                                                           |
| Movement rule blocks a drag/drop or Move-to action     | Return 403 `BOARD_MOVE_FORBIDDEN`; roll back optimistic placement and toast                           |
| Bot generates invalid JSON                             | `boardConfigSchema.safeParse` catches it; no action is emitted and nothing is written to the database |

---

## 14. Open Questions

All listed questions were resolved by Stages 1–5.

1. **Column placement persistence (§4.3):** Resolved—Option A using nullable
   `work_items.board_column_id`.

2. **Designer location (§6):** Resolved—Project Details Board tab.

3. **Admin bypass:** Resolved—none. Roles match exactly.

4. **Validation rule semantics:** Resolved—hard policy denial with HTTP 403 and
   `BOARD_MOVE_FORBIDDEN`.

5. **Draft status in columns:** Resolved—Draft is excluded from board columns.

6. **Missing status coverage:** Resolved—schema validation blocks save.

7. **Configuration scope:** Resolved—one board config per project.

8. **Bot tool approach:** Resolved—the existing Alice chat tool loop exposes
   `list_board_entities` and draft-only `configure_board_draft`; a validated
   `configure_board` action hands the draft to Board Designer.

9. **Column ID stability:** Resolved—designer-generated stable IDs, persisted in
   `board_column_id`; IDs need only be non-empty and unique within the config.

10. **Movement rule OR vs AND:** Resolved—OR across `allowAnyOf` matchers on an
    exact source/destination pair.

---

## 15. Relevant Existing Files

### Backend / API

| File                                                      | Relevance                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/api/src/routes/api/workItems/workItems.service.ts`  | Add column-move permission check before the status PATCH                  |
| `apps/api/src/routes/api/workItems/workItems.route.ts`    | Wire any new validation into the route handler                            |
| `apps/api/src/routes/api/workItems/workItems.errors.ts`   | Defines the stable `BoardMoveForbiddenError` policy denial (403)          |
| `apps/api/src/routes/api/projects/projects.route.ts`      | Extend or add an endpoint to save `workflow_config`                       |
| `apps/api/src/routes/api/projects/projects.repository.ts` | `patch.attributes_config` pattern (lines 81–82) shows how to write JSONB  |
| `apps/api/src/routes/api/chat/chat.route.data.ts`         | Declares board entity and draft tools and the draft-only protocol         |
| `apps/api/src/routes/api/chat/chat.service.ts`            | Checks access/role, resolves entities, validates, and emits draft actions |
| `apps/api/src/routes/api/chat/board-draft.ts`             | Resolves stable/temporary column references into a validated BoardConfig  |

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

## 16. Implementation Stages

**Stage 1 — Schema and storage (implemented)**

- Define `boardConfigSchema` Zod type in `packages/types/src/api/v1/board-config.ts`.
- Extend `projectDetailSelect` to include `workflow_config`.
- Extend `PUT /api/projects/:id` (or add a new endpoint) to accept and validate `workflow_config`.
- Write unit tests for `boardConfigSchema` (valid, invalid JSON, wrong version).

**Stage 2 — Board placement and fallback (implemented)**

- Update `board-data.tsx` to parse `workflow_config` via `boardConfigSchema.safeParse`.
- Pass resolved columns to `KanbanBoard`.
- Update column render and drop handlers to use dynamic columns.
- Verify default fallback works when config is absent or parse fails.
- Write unit tests for the `assignItemsToColumns` function.

**Stage 3 — Designer UI (implemented)**

- Create `BoardDesignerWorkspace` component (JSON editor + column preview panel).
- Add the designer surface to the chosen location (Project Details tab or Board drawer).
- Wire "Validate & Save" to the API endpoint.

**Stage 4 — Transition movement rules (implemented)**

- Add version-2 source/destination transition schema with OR matchers.
- Enforce rules in `WorkItemService.updateWorkItem` using active actor context.
- Return stable 403 denials and roll optimistic UI state back with a toast.
- Test role, team, user, stale-reference, All Projects, route, designer, and
  rollback behavior.

**Stage 5 — Alice bot integration (implemented)**

- Add `list_board_entities` and `configure_board_draft` to the existing Alice
  function-calling tool loop.
- Verify project access before returning the current valid board, active
  project teams, and active project members.
- Restrict structured drafts to managers and administrators; members retain
  conversational suggestions and a read-only designer.
- Preserve existing column IDs and unaffected transition rules. New columns
  use model-local temporary keys that the application replaces with
  `crypto.randomUUID()` values before validation.
- Validate every result with the shared `boardConfigSchema`; invalid output
  emits no `configure_board` action.
- Hand valid drafts to Board Designer through
  `sessionStorage["board_draft_${projectId}"]`, never through the URL or the
  database.
- Revalidate and consume the ephemeral draft in Board Designer while retaining
  the saved configuration as the baseline, marking the draft dirty, and
  requiring the user to save through the existing project update path.
- Preserve Stage 3 deletion confirmation for persisted columns omitted by an
  Alice draft. No work items or `board_column_id` values are mutated.

**Stage 6 — Column placement**

- Completed early in Stage 2 using `work_items.board_column_id`.

---

## 17. Testing Strategy

| Scope                 | What to test                                                                               | Location                     |
| --------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| **Schema validation** | Valid v1/v2 configs, transition references/pairs/matchers, status coverage, invalid values | `apps/web/tests/board/`      |
| **Column assignment** | Exact placement, null/stale status fallback, same-status movement, Draft exclusion         | `apps/web/tests/board/`      |
| **Fallback**          | Null config, parse failure, version mismatch all render default columns                    | `apps/web/tests/board/`      |
| **Movement rules**    | Exact role, active team/member, OR, stale refs, All Projects, stable 403                   | `apps/api/tests/work-items/` |
| **API save**          | Valid body persists; invalid body returns 400; unauthorized returns 403                    | `apps/api/tests/projects/`   |
| **Bot integration**   | `configure_board` tool returns a valid `BoardConfig` shape                                 | `apps/api/tests/chat/`       |
| **Designer UI**       | Rule authoring, v1 compatibility, Everyone removal, scoped selectors, rollback/toast       | `apps/web/tests/`            |

Run all tests with:

```powershell
pnpm --filter api test
pnpm --filter web test
```

Follow the conventions in `.cursor/rules/08-qa-dev-manager.mdc` when adding
coverage.
