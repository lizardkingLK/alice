# Project types

Configure the project’s work-item **type catalog** (name, icon, description,
hierarchy level) — including custom types beyond the create defaults.

**Audience:** Managers and admins

---

## Open Types

1. Go to **Projects** and open a project.
2. In the project sidebar, select **Types** (`/projects/[id]?tab=types`).
   The tab uses a shapes icon so it stays distinct from Fields and Board.

Managers and admins who can access the project workspace see **Types**.
**Members** do not see the Types, Workflow, Board, Fields, Teams, Sprints, or
Integrations sidebar entries (deep links fall back to Details).

On **Types**, edit the catalog as a stacked list: add types, rename display
names, set icons and descriptions, and reorder **levels** (one linear
parent→child chain). Removing a saved type asks for confirmation. When you save
after removing types that still have work items (active or archived), a conflict
dialog asks how to handle each type: **delete permanently** or **convert to** a
remaining type. Parent links that would become invalid are detached first.
Archive is not offered, because restoring would put a removed type back into the
project.

Submit **Save Types** when finished. See
[Work-item types and hierarchy](./work-item-types-and-hierarchy.md) for hierarchy
rules, forms, and Jira mapping.

---

## Branding and metadata

Project name, dates, description, and owner appear on the **Details** banner.
The key badge includes a **copy** control for the shareable `/projects/{KEY}`
link (see [Browse projects](./browse-projects.md#share-a-project-link)).
Managers and admins on an **active** project can select **Edit** to open a light
dialog for those fields plus status (active/archived). Owner options are limited
to users with the **manager** role. Cover and logo actions appear only on
**active** projects.

On an **archived** project, **Edit**, cover, and logo are hidden. Managers and
admins see **Restore**; admins also see **Purge**. Both reuse the same
confirmation dialogs as the Projects registry Archived tab.

---

## Delete and archive

- **Archive** removes the project from the active registry tab
- **Hard delete** is restricted to **admins** and permanently removes the project

Confirm destructive actions carefully — work items and history may be affected.

---

## Related

- [Browse projects](./browse-projects.md)
- [Project members](./project-members.md)
- [Work-item types and hierarchy](./work-item-types-and-hierarchy.md)
