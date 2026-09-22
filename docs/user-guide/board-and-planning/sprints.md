# Sprints

Create sprints, track goals, and open burndown reports.

**Audience:** Managers and admins

---

## Open sprints

1. Sign in as a **manager** or **admin**.
2. Open a project from **Projects** in the sidebar.
3. In the project sidebar, select **Sprints** (`/projects/[id]?tab=sprints`).

Members do not see the Sprints project tab. The standalone `/sprints` page
remains available for bookmarks but is no longer linked from the main sidebar.

---

## Registry

The sprints list shows active and archived sprints for the current project. Use:

- **Add Sprint** — create a new iteration (name, dates, goal) in this project
- Search — find sprints by name or goal
- Tabs — **Active** / **Archived** icon segment switcher (right side of the
  toolbar)

Sprint names must be **unique within the project**, including archived sprints.
If you reuse a name, the form shows: _An active or archived sprint already
exists by the given name_.

Select a sprint to open its report or related work.

---

## Sprint reports

Open `/sprints/[id]/report` for burndown and progress metrics.

- **Active**, **completed**, and **archived** sprints show the live report
  (stats, charts, deliverables).
- **Planned** sprints open the same report layout as a **placeholder** — charts
  and metrics stay locked until the sprint becomes active or is completed.

Breadcrumbs include a `from` query so navigation context stays clear:

| Opened from      | Trail includes |
| ---------------- | -------------- |
| Sprints registry | Sprints        |
| Backlog          | Backlog        |

Assign work to a sprint from the backlog, work-item sidebar, or create forms.

---

## Create sprints with Alice

You can also create and manage sprints conversationally using Alice:

- Ask: _"List active sprints in Project Mobile"_
- Ask: _"Create Sprint 12 for Project Mobile from October 1 to October 15 with goal 'Launch Auth flow'"_

Alice validates the dates, project permissions, and returns an action card linking directly to the new sprint.

---

## Related

- [Backlog](./backlog.md)
- [Kanban board](./kanban-board.md)
- [Use the AI assistant](../chat/use-ai-assistant.md)
