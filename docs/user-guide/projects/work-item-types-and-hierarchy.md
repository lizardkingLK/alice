# Project Work-Item Types & Hierarchy

Configure a project’s work-item type catalog (name, icon, description, hierarchy
level) and map Jira issue types during import.

**Audience:** Managers and admins

---

## Overview

Each project has its **own type catalog**. You are not limited to a fixed global
list: you can add types that match how your team works (for example Initiative,
Spike, or Defect), set an icon and description, and order them in a **single
parent → child chain**.

New projects start from ALICE **defaults** (Epic, Feature, Story, Task, Issue).
Those defaults are templates you can keep, rename, reorder, or extend.

### Hierarchy (levels)

Types form one linear chain by **level** (lowest number = top of the tree):

```text
Level 0 (e.g. Epic)
 └── Level 1 (e.g. Story)
      └── Level 2 (e.g. Task)
           └── Level 3 (e.g. Issue)   ← leaf: no subtasks
```

- Reordering levels changes which type may parent which child.
- Only one type may occupy each level in a project.
- Non-linear trees (multiple different child types under one parent) are not
  supported.

> [!NOTE]
> Each type has a hidden stable **key** (stored on work items and used in
> imports). New custom types get an opaque UUID key automatically. The **name**
> is what people see in pickers and badges; names must be unique in the project.
> Renaming does not break existing work items.

---

## 1. Project creation

When creating a project as an administrator:

1. Go to **Projects** (`/projects`) and select **Add Project** / **+ New Project**.
2. Complete **Details**, then open the **Types** step.
3. Start from the default catalog (or a subset). For each type you can adjust:
   - **Name** and optional **description** (name updates the card immediately)
   - **Icon** via the icon picker and **color** via the color picker
   - **Level** / order by dragging cards
4. **Add** custom types if needed (each gets a hidden stable key; pick a unique
   name, icon, and color).
5. At least one type is required; duplicate names are blocked.
6. Continue through **Imports**, **Source**, optional **Sprint** / **Team**, then
   create the project. The catalog is stored in the project’s workflow
   configuration.

After sign-in, ALICE caches each accessible project’s type catalog locally so
type labels and icons stay fast to resolve; the server remains the source of
truth and the cache refreshes when types change.

---

## 2. Create & edit work-item forms

- The **Type** dropdown shows only types from the **active project’s** catalog
  (name + icon; the form still submits the hidden key).
- The API rejects create/update with a type key that is not in that catalog.
- Filters on Work Items, Board-related views, and Calendar use the **union of
  types across projects you can access** when no single project is selected, and
  the active project’s catalog when one is — not a hard-coded global five-type list.

---

## 3. Removing types that already have work items

Work items always have a type key.

When you remove a type from the catalog and items still use that key (active or
archived):

1. **Save is blocked** until you choose a strategy for each affected type.
2. A conflict dialog lists work items under each removed type.
3. For each type, choose:
   - **Delete permanently** — hard-deletes those work items (archive is not
     offered, because restore would reintroduce a removed type).
   - **Convert to…** — migrates them to another type that remains in the catalog.
4. **Detach first** — parent links that would be invalid are cleared before
   delete/migrate.
5. If a removed type was the allowed child of a kept parent, the dialog warns
   that those parent→child links will be unlinked.

If no work items use the removed keys, the catalog saves without the dialog.

---

## 3b. Changing type on a single work item with subtasks

When you change the type of a work item that still has direct subtasks:

1. ALICE asks how to proceed (default: **unlink subtasks, then change type**).
2. Confirming detaches those children and applies the new type. If the new type
   cannot keep its current parent, that parent link is cleared as well.
3. You can cancel and unlink subtasks yourself first, then change the type.

Leaf items (no children) change type without this prompt.

---

## 4. Types tab (ongoing configuration)

Managers and admins can edit the catalog any time:

1. Open the project and select the **Types** tab (`/projects/[id]?tab=types`).
2. In the work-item types card:
   - Edit **name**, **description**, **icon**, and **level** / order.
   - **Add** a new type or **remove** an existing one (removal may open the
     conflict dialog on save).
3. Select **Save Types**.
4. **Re-adding** a similar type later creates a new catalog entry (or restore a
   key only if you explicitly keep that key). Items that were deleted or
   converted earlier are not automatically restored.

---

## 5. Sprint planning and parent–child items

Work items with a **parent** inherit that parent’s sprint (Jira-style):

- On **work item details**, Sprint is read-only text: the sprint name or **Backlog**.
- In **create/edit forms** and the **backlog** sheet, you cannot assign a different
  sprint while a parent is linked.
- Moving the **parent** into or out of a sprint updates all descendants
  automatically.

To plan a child in a different sprint, remove the parent link or use a separate
top-level work item instead of a subtask.

Sprint names cannot be **Backlog** (case-insensitive) — that label is reserved
for unscheduled work.

---

## 6. Jira import & hierarchy mapping

When importing issues from Jira:

1. Open the project **Integrations** tab and the **Jira Cloud** card.
2. Select **Jira Import & Hierarchy Mapping** to scan issue types from the linked
   Jira project.
3. **Configure type handling** for each Jira issue type:
   - **Map to** a type in this project’s catalog (by key / display name).
   - **Ignore (Skip)** — skip those issues; children may import with no parent.
   - **Drop / fallback** — import as a chosen fallback type in the catalog
     (defaults often use Issue).
4. **Configure hierarchy** by ordering catalog levels (up/down). Add types to the
   catalog when the import needs new keys.
5. **Start Import**:
   - Issues receive mapped type keys.
   - Parent–child links follow the linear level chain.
   - The updated catalog is saved on the project (client type cache refreshes).

---

## 7. Related documentation

- [User testing guide](./work-item-types-testing.md)
- [Project types](./project-settings.md)
- [Create a project](./create-project.md)
- [Project integrations](./project-integrations.md)
