# Project types

Configure which work-item types are permitted in a project.

**Audience:** Managers and admins

---

## Open Types

1. Go to **Projects** and open a project.
2. In the project sidebar, select **Types** (`/projects/[id]?tab=types`).
   The tab uses a shapes icon so it stays distinct from Fields and Board.

Managers and admins who can access the project workspace see **Types**.
**Members** do not see the Types, Workflow, Board, Fields, Teams, Sprints, or
Integrations sidebar entries (deep links fall back to Details).

On **Types**, permitted work-item types use a stacked list with confirmation
before removing a previously saved type. When you save after removing types that
still have work items (active or archived), a conflict dialog asks how to handle
each type: **delete permanently** or **convert to** a remaining type. Parent
links that would become invalid are detached first. Archive is not offered,
because restoring would put a disallowed type back into the project.

Submit **Save Types** when finished.

---

## Branding and metadata

Project name, dates, description, and owner appear on the **Details** banner.
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
