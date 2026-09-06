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
- Tabs — **Active** / **Archived**

Select a sprint to open its report or related work.

---

## Sprint reports

Open `/sprints/[id]/report` for burndown and progress metrics. Reports are
available for **active**, **completed**, and **archived** sprints — not
**planned** ones.

Links include a `from` query so the unavailable-state back button returns you
to the right place:

| Opened from      | Back button         |
| ---------------- | ------------------- |
| Sprints registry | **Back to Sprints** |
| Backlog          | **Back to Backlog** |

Assign work to a sprint from the backlog, work-item sidebar, or create forms.

---

## Related

- [Backlog](./backlog.md)
- [Kanban board](./kanban-board.md)
