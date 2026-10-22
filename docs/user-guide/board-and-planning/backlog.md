# Backlog

Groom unscheduled work and assign items to sprints.

**Audience:** All users

---

## Open backlog

1. In the sidebar under **Platform**, select **Backlog** (`/backlog`).

---

## Layout

Typical layout:

- **Backlog pane** — items not in a sprint (or unscheduled work)
- **Sprint cards** — active sprints with room for planned items

The toolbar matches other registries: **Search**, **Filter** (**Shift+F**), and
applied-filter badges (when active) on the left; **Layout** (icon), **Capacity
display** (gauge icon), **Active** / **Completed** tabs, and a **+** menu
(**Create Sprint** / **Create Work-Item**) on the right.

**Capacity display** (saved per user in the browser) controls how sprint capacity
appears on each sprint card header:

| Mode                       | What you see                                                              |
| -------------------------- | ------------------------------------------------------------------------- |
| **Progress bar** (default) | Thin bar plus `planned / capacity` in the sprint header                   |
| **Numbers**                | Compact `planned / capacity` (or planned pts) in the sprint header        |
| **Percentage**             | Rounded percent of capacity used (for example `33%`) in the sprint header |

Hover the **info** icon next to the sprint name for dates, status, project, and
the full capacity breakdown. Over-capacity values use a rose accent; near-full
(≥90%) uses amber on the bar.

**Workspace defaults** (project and optional sprint) are set from the Filter
dialog with **Set as default** on the Project or Sprint pane. With no saved
defaults, backlog opens to All projects / All sprints. When a sprint is saved
in defaults, the sprint cards pane can focus that sprint for the project.

---

## Plan into a sprint

1. Open **Filter** (**Shift+F**) to narrow by project, sprint, assignee, or
   priority if needed. In the Sprint pane, sprints are listed under their
   project (sections start expanded); search hides non-matching sprints and
   empty project groups. Check **Set as default** on Project or Sprint before
   Okay if you want those values saved for next visits.
2. **Drag** items from the backlog into a sprint card (or from a sprint back
   to the backlog). Child items follow their parent’s sprint — move the parent
   (or unlink it) if you need to plan a child separately. Re-drags while a
   save is running keep the latest sprint; rows dim slightly until the flush
   finishes. Closing the tab with pending sprint moves may show a leave
   warning.

Managers and admins can **Create Sprint** from the toolbar **+** menu. The form
defaults to your backlog **default project** (or the project currently selected
in filters), and you can change it. Sprint names must be unique within a
project — including archived sprints — and the form shows an error if the name
is already taken. Use the **+** icon on the backlog header to create an
unscheduled work item, or the **+** on a sprint header to create a work item
already assigned to that sprint (project locked when the sprint has one). Hover
the numeric count next to **+** to see how many work items are in that list.

Sprint cards keep a compact header: click the sprint name or hover the info icon
for dates, status, project, and capacity details; use **Capacity display**
(above) for the compact header layout (progress bar, numbers, or percentage).
Manager/admin actions (**Summary report**, **Start sprint**, **Complete sprint**)
are icon buttons with tooltips.

---

## Complete a sprint

On a sprint card, use the **Complete sprint** checkmark icon when the iteration
ends (manager/admin workflows). Review open items before completing.

---

## Related

- [Sprints](./sprints.md)
- [Work items](../work-items/README.md)
