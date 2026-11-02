# Technical Specification: Dynamic Project Work-Item Types & Hierarchy

Technical architecture for **per-project arbitrary work-item type catalogs**, linear
hierarchy derived from levels, create defaults, client catalog cache, Jira import
mapping, and type removal/migrate.

**Status:** Target design (ambition B). Replaces the fixed Postgres `WorkItemType`
enum and enable/disable checkbox model.

---

## 1. Architecture

### 1.1 Catalog model

Each project owns a **type catalog** in `projects.workflow_config.work_item_types`:

```ts
type ProjectWorkItemTypeDef = {
  key: string; // stable identity stored on work_items.type
  name: string; // display label (renameable)
  description?: string;
  icon: string; // controlled Lucide / token key
  level: number; // 0 = top; unique per project
};
```

| Field         | Rules                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`         | Unique per project. **Immutable after create** (change only via migrate/removal). Seed keys keep `Epic` / `Feature` / `Story` / `Task` / `Issue` so existing rows need no value rewrite. |
| `name`        | UI / import display. Bindings and storage use `key`.                                                                                                                                     |
| `description` | Optional help text on Types tab / pickers.                                                                                                                                               |
| `icon`        | Controlled vocabulary; unknown → safe fallback icon.                                                                                                                                     |
| `level`       | Non-negative integer, **unique** in the project. Sort ascending → single parent→child chain.                                                                                             |

Constraints (Zod + API):

- At least one type definition.
- Unique `key`, unique `level`.
- Non-empty `name`.

### 1.2 Linear hierarchy (levels)

Same product rule as today: **one linear chain**, not a forest.

```text
level 0 → level 1 → … → level N (leaf)
```

Runtime derives `parentToChild` / `childToParent` by sorting defs by `level` and
linking adjacent pairs. Leaf has no child. Parent/child create-edit rules use that
derived map.

The legacy `workflow_config.hierarchy` parent→child **map** is transitional:
writers may still persist a derived map for back-compat; readers prefer
level-derived hierarchy. After cutover, the map can be dropped.

### 1.3 Defaults (create + migration seed)

Today’s five types are **seed templates**, not a closed system enum:

| key     | default name | default level (canonical) | notes                             |
| ------- | ------------ | ------------------------- | --------------------------------- |
| Epic    | Epic         | 0                         |                                   |
| Feature | Feature      | 1                         | Optional in default create subset |
| Story   | Story        | 2                         |                                   |
| Task    | Task         | 3                         |                                   |
| Issue   | Issue        | 4                         | Leaf in default chain             |

- **Project create:** wizard starts from `DEFAULT_SYSTEM_HIERARCHY` defs
  (Epic → Story → Task → Issue). **Feature is optional** (in full seed catalog,
  not pre-selected). Users may add/rename/reorder before save.
- **Migration backfill:** legacy `work_item_types: string[]` expands to defs for
  those keys; any orphan `work_items.type` values get stub defs.

### 1.4 Persistence

| Store                             | Role                                                      |
| --------------------------------- | --------------------------------------------------------- |
| `work_items.type`                 | `text` holding the catalog **`key`** (was Postgres enum). |
| Chart rollups / RPCs              | Same: `text` type key.                                    |
| `workflow_config.work_item_types` | Array of `ProjectWorkItemTypeDef`.                        |
| Workflow `typeBindings`           | Bind workflow graphs by type **`key`**.                   |

Authority is always DB/API. Client cache is a revisioned mirror only.

```text
workflow_config type defs
        │
        ├─ validate work_items.type ∈ keys
        ├─ sort by level → hierarchy maps
        └─ revision → client catalog cache
```

---

## 2. Client catalog cache

| Item        | Detail                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Storage key | `alice:wit-catalog:v1:{userId}`                                                                                  |
| Payload     | Per project: `{ revision, types: ProjectWorkItemTypeDef[] }`                                                     |
| Bootstrap   | On login (and revalidate on focus / workflow_config soft-invalidate / successful type-config mutation)           |
| Skip apply  | When remote `revision` matches cached                                                                            |
| UI resolve  | `(projectId, typeKey) → name / icon / description / level`; fallback to seed defs only if project not yet loaded |
| Mutations   | Never write catalog through localStorage alone                                                                   |

`revision` = hash of the types defs array or `projects.updated_at` (implementation
picks one; must bump whenever the catalog changes).

Lean bootstrap may use projects list payload or a dedicated catalog summary
endpoint: `{ projectId, revision, types[] }`.

---

## 3. Core modules & files

### Shared types (`packages/types`)

- **`src/work-item-types.ts`**
  - `DEFAULT_WORK_ITEM_TYPE_DEFS` — create/migration seeds.
  - `resolveProjectHierarchyFromLevels(defs)` — linear chain from levels.
  - Import helpers: map external type strings → project **keys** (seed aliases for
    common Jira names; unknown → configured fallback key).
  - Legacy enum helpers deprecated / removed after cutover.
- **`src/api/v1/board-config.ts`**
  - `projectWorkflowConfigSchema.work_item_types` = array of def objects.
- **`src/api/v1/jira-import-types.ts`**
  - Type mapping targets are project keys; hierarchy UI = level order.
- **`src/api/v1/projects.ts`**
  - Removal preview/apply strategies still `delete` \| `migrate` (+ `migrateTo` key).

### API (`apps/api`)

- Project create seeds default (or wizard) defs.
- Project update validates catalog; requires `typeRemovalStrategies` when removing
  keys that still have work items.
- Work-item create/update: type ∈ project keys; parent/child from level-derived map.
- Jira preview/import: map Jira issue types → keys; reorder levels on import config;
  persist catalog (+ optional derived hierarchy during transition).

### Web (`apps/web`)

- Types tab / create wizard: catalog editor (add, rename, description, icon, reorder
  levels) — not enable/disable checkboxes only.
- Badges, forms, board, backlog, calendar, filters: resolve presentation from the
  **project** catalog (filters must not assume a global fixed five).
- Presentation helpers resolve by catalog; seed-key CSS tokens for known keys;
  custom keys → neutral default token (v1; no per-type color picker).

---

## 4. Type removal & single-item type change

Unchanged product rules, keyed by catalog **`key`**:

- Removing a type that still has items (active or archived) requires per-type
  **delete** or **migrate** to a remaining key.
- Detach parent links that would be invalid before delete/migrate.
- Changing type on a parent with subtasks: confirm detach-children (or cancel).

---

## 5. Jira import

1. Discover Jira issue types.
2. For each: **map** to a project type key, **ignore**, or **drop** with a
   **fallback picker** among catalog types (default **Issue** when present).
3. Edit target hierarchy by **reordering levels** (renumber `level`); may add types
   to the catalog when import introduces new keys.
4. Import applies mapped keys; parent links follow the linear level chain.
5. Saving import updates `workflow_config` catalog (and bumps cache revision).

---

## 6. Migration outline

1. Alter `work_items.type` (and rollup/RPC params) from enum → `text`.
2. Backfill each project’s `work_item_types` string array → def objects.
3. Stub defs for orphan type values present on rows but missing from config.
4. Drop Postgres `WorkItemType` enum once verified.
5. Regenerate `@repo/types` clients; remove enum-coupled UI `Record`s.

---

## 7. Out of scope (v1)

- Per-type custom colors / uploaded icons.
- Non-linear / multi-parent hierarchy.
- Cross-project global type taxonomy.
- Azure DevOps-specific mappers (reuse generic string→key mapping later).

---

## 8. Related documentation

- User guide: [Work-item types and hierarchy](../../user-guide/projects/work-item-types-and-hierarchy.md)
- Testing: [Work-item types testing](../../user-guide/projects/work-item-types-testing.md)
- Project Types tab: [Project types](../../user-guide/projects/project-settings.md)
