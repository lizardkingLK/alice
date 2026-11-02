# User Testing Guide: Dynamic Project Work-Item Types & Hierarchy

Step-by-step checks for **project type catalogs**, **level-based hierarchy**,
**form scoping**, **removal/migrate**, **custom types**, and **Jira import**
mapping to catalog keys.

**Audience:** Managers, Administrators, QA Engineers, and Developers

---

## Prerequisites & Environment Setup

1. **API Backend Server** running on `http://localhost:5000`:
   ```bash
   corepack pnpm --filter api dev
   ```
2. **Web Frontend Server** running on `http://localhost:3000`:
   ```bash
   corepack pnpm --filter web dev
   ```
3. **User Account**:
   - Sign in as an **Admin** or **Manager** at `http://localhost:3000`.

---

## Test Scenarios

### 1. Project creation with default catalog

1. Navigate to **Projects** (`/projects`) and open **+ New Project** / **Add Project**.
2. In **Work-Item Types**:
   - Verify defaults are present (Epic, Feature, Story, Task, Issue) with name,
     icon, description, and level/order controls — not only bare checkboxes.
   - Clear all types (or remove until empty) and advance:
     - Expect validation: at least one type required.
3. Keep Epic, Story, Task, Issue; remove or omit Feature (or leave Feature out of
   the active set).
4. Optionally **add** a custom type (e.g. name `Spike`, place it at an unused
   level).
5. Finish create and open the project **Types** tab:
   - Verify the saved catalog matches (including custom type if added).

---

### 2. Create & edit work-item form scoping

1. **Work Items** → **+ New Work Item**; select the project.
2. Open **Type**:
   - Only catalog types for that project appear (display **names**).
   - Omitted defaults (e.g. Feature) and types from other projects do not appear.
3. Create a top-level item and a child under an allowed parent type.
4. Edit the child: Type dropdown remains scoped to the same catalog.

---

### 3. Filters follow accessible project catalogs

1. Open **Work Items** → **Filter** → Type options:
   - Options reflect types from projects you can access (including custom keys),
     not a hard-coded global five-only list.
2. Repeat for **Calendar** filters with the same expectation.

---

### 4. Types tab: remove type with conflict dialog

1. Open the project → **Types**.
2. Remove a type that still has work items (e.g. Story).
3. **Save Types**:
   - Complete conflict dialog (**Convert to** another catalog type, or **Delete
     permanently**).
4. Verify work items and parent links follow the strategy (detach-first).

---

### 5. Types tab: add / rename / reorder

1. On **Types**, rename a type’s **display name** (key unchanged).
2. Save; open a work item of that type — badge/label shows the new name.
3. Reorder **levels** so the linear chain changes (e.g. insert Feature between
   Epic and Story).
4. Save; verify create-subtask / parent rules follow the new adjacent levels.
5. Add a new type at the leaf or middle level; save; confirm it appears in the
   Type dropdown.

---

### 6. Client catalog cache (smoke)

1. Sign out and sign in again.
2. Open board / work-item UI that shows type badges before editing Types:
   - Labels/icons resolve without a visible “unknown type” flash for cached
     projects (best-effort smoke).
3. Change the catalog on **Types** and save:
   - UI elsewhere in the same session picks up new names/icons after
     invalidation (refresh or navigation as designed).

---

### 7. Jira import & level mapping

1. Project → **Integrations** → **Jira Import & Hierarchy Mapping**.
2. Map at least one Jira type to a **catalog key**; set one to **Ignore**; set one
   to drop/fallback.
3. Reorder hierarchy **levels** with Up/Down.
4. **Start Import**:
   - Mapped issues use the correct keys.
   - Ignored skipped; fallback uses the chosen catalog type.
   - Parent links follow the linear level chain.
5. **Types** tab reflects any catalog updates from import.

---

## Summary Checklist

| #   | Test Case                     | Expected Result                                  | Pass/Fail |
| --- | ----------------------------- | ------------------------------------------------ | :-------: |
| 1   | Create with defaults / custom | Catalog editor; ≥1 type; custom type persists    |    [ ]    |
| 2   | Form type scoping             | Only project catalog types                       |    [ ]    |
| 3   | Filters                       | Project-accessible catalogs, not fixed five-only |    [ ]    |
| 4   | Remove type                   | Conflict dialog; delete or convert; detach-first |    [ ]    |
| 5   | Rename / reorder / add        | Name and levels apply; dropdown updates          |    [ ]    |
| 6   | Cache smoke                   | Resolve after login; refresh after Types save    |    [ ]    |
| 7   | Jira map / ignore / fallback  | Keys + linear levels applied                     |    [ ]    |
| 8   | Jira hierarchy order          | Level order saved on project config              |    [ ]    |
