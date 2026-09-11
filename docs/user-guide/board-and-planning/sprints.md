# Sprints

Create sprints, track goals, and open burndown reports.

**Audience:** Managers and admins

---

## Open sprints

1. Sign in as a **manager** or **admin**.
2. Under **Projects** in the sidebar, select **Sprints** (`/sprints`).

Members do not see the Sprints nav item.

---

## Registry

The sprints list shows active and archived sprints. Use:

- **Add Sprint** — create a new iteration (name, dates, goal)
- Search — find sprints by name or goal
- **Filter** icon (**Shift+F**) — open the filter dialog and choose a
  project (or **All projects**)
- Tabs — **Active** / **Archived** icon segment switcher (right side of the
  toolbar)

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
