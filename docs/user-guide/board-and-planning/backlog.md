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
applied-filter badges (when active) on the left; **Layout** (icon), **Active** /
**Completed** tabs, and a **+** menu (**Create Sprint** / **Create Work-Item**)
on the right.

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
2. **Drag** items from the backlog into a sprint card.

Managers and admins can **Create Sprint** from the toolbar **+** menu. The form
defaults to your backlog **default project** (or the project currently selected
in filters), and you can change it. Sprint names must be unique within a
project — including archived sprints — and the form shows an error if the name
is already taken. Use the **+** icon on the backlog header to create an
unscheduled work item, or the **+** on a sprint header to create a work item
already assigned to that sprint (project locked when the sprint has one). Hover
the numeric count next to **+** to see how many work items are in that list.

Sprint cards keep a compact header: click the sprint name or hover the info icon
for dates, status, and project; hover the **gauge** icon for sprint capacity
(planned story points vs configured team capacity). Manager/admin actions
(**Summary report**, **Start sprint**, **Complete sprint**) are icon buttons
with tooltips.

---

## Complete a sprint

On a sprint card, use the **Complete sprint** checkmark icon when the iteration
ends (manager/admin workflows). Review open items before completing.

---

## Related

- [Sprints](./sprints.md)
- [Work items](../work-items/README.md)
