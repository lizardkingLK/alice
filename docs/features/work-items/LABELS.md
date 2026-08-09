# Work-item labels

Status: **Implemented**

Free-form string labels on each work item, stored as a JSONB text array (not a
shared catalog). Used on create forms, details editing, and list search.

Related:

- Feature index: [README.md](./README.md)
- Schema: `work_items.labels` in `packages/db/prisma/schema.prisma`
- Shared helpers: `packages/types/src/work-item-labels.ts`
- API: `apps/api/src/routes/api/workItems/`
- UI: classic/modern create, details sidebar patch, search results panel

---

## Storage

| Column   | Type                     | Default |
| -------- | ------------------------ | ------- |
| `labels` | `JSONB` array of strings | `[]`    |

- GIN index (`jsonb_path_ops`) for exact containment (`@>` / PostgREST `cs`).
- Check constraint: `jsonb_typeof(labels) = 'array'`.

## Validation

Shared via `normalizeWorkItemLabels` / `parseWorkItemLabels`:

- Trim each label; drop empties
- Max **40** characters per label
- Max **32** labels per work item
- Case-sensitive uniqueness within the array

## Surfaces

| Surface             | Behavior                                                       |
| ------------------- | -------------------------------------------------------------- |
| Classic create/edit | Always shows chip input; FormData `labels` JSON string         |
| Modern create       | Optional “Labels” under More; chip row when enabled            |
| Details sidebar     | Real badges (or “No labels”); pencil opens field-patch dialog  |
| List search         | Title `ilike` **or** exact case-sensitive label containment    |
| List filter dialog  | Same chip input; `?labels=["A","B"]`; OR exact GIN containment |

## Search UX

When `?search=` is set:

1. Backend returns the union of title and label matches.
2. Above the table, a **Search results** panel categorizes:
   - **Title matches** — substring highlight (case-insensitive)
   - **Label matches** — matching label pills (exact, case-sensitive)
3. The filtered table remains underneath for column browsing.

A row can appear in both sections when both title and label match.

## Non-goals (v1)

- Global label catalog / cross-project autocomplete
- Case-insensitive or substring label search
- Board/kanban card label chrome
- Replacing the work-items table layout
