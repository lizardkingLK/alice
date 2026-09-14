# Calendar view

Plan and reschedule work by due date on a month grid.

**Audience:** All users

---

## Open calendar

1. Select **Board** in the sidebar.
2. Open the **Calendar** tab (`/board?tab=calendar`).

---

## Toolbar

**Left:** **Filter** (**Shift+F**), Clear filters (when active), and **Defaults**
(sliders).

**Right:** Month navigation, **Today**, and **Unscheduled** (list icon — opens
the unscheduled panel; no count badge).

---

## What you see

- A **month grid** loaded with work items that have a **due date** in the visible
  grid range (current month plus leading/trailing days). Changing month or
  filters refetches that range.
- An **Unscheduled** side panel (when open) for items with no due date. The panel
  loads matching unscheduled items into local state (search and pagination run
  in memory). Use **Refresh** to reload from the server; drag-to-schedule
  updates the list locally.

---

## Day drawer

Select a day to open a side drawer:

- **Due** — work items for that date from the loaded month range, with sticky
  bottom pagination
- **Create** — modern create form with actions pinned to the bottom of the
  drawer

Select a work-item row to edit it in a dialog. Closing the dialog leaves the day
drawer open.

---

## Change due dates

Drag an item from the unscheduled list onto a day, or drag between days on the
grid, to update its due date.

---

## Tips

- Use the **Filter** icon (**Shift+F**) for project, sprint, assignee, and type.
- Items without due dates won't appear on the grid until scheduled.

---

## Related

- [Kanban board](./kanban-board.md)
- [Edit a work item](../work-items/edit-work-item.md)
