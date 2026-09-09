# Charts

Build a personal chart board with drag-and-drop widgets — similar to Overview,
with a Monday-style catalog for adding more.

**Audience:** All users

---

## Open Charts

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Charts**.

You'll land on `/charts`. The board card fills the remaining space under the
toolbar (with the usual page padding).

---

## Add a widget (quick)

1. Select **Add Widget**.
2. Choose **Chart** (other options show **Coming soon** and stay disabled until
   they ship).

The widget appears on the board right away. You can add Chart more than once.

---

## Browse Widgets

1. Open **Add Widget**.
2. Select **More widgets** at the bottom of the menu.
3. Browse categories in the left sidebar, or use **Search**.
4. On a **Chart** card, select **Add widget**. Other cards show **Coming soon**.

You can add Chart more than once — each placement is a separate instance (for
example two charts with different filters).

---

## Arrange the board

- Hold the **grip** on the left of a widget to **drag** it
- Resize from the **bottom-right** corner
- Open the **⋯** menu for **Full screen**, **Rename**, **Duplicate**, or
  **Delete** (**Settings** and **Dock this widget** are disabled for now)
- Use **Clear board** to remove all widgets on this device

Chart widgets on the board always show the pie. Layout modes (Chart / Table /
Split) apply only inside the fullscreen configuration window and are saved in
the browser for now. Cloud save and shareable chart boards are coming later.

---

## Chart layout modes

Open a **Chart** widget in full screen (filter icon or **⋯ → Full screen**).
Use the **split view** button in the toolbar to choose:

| Layout     | What you see                                             |
| ---------- | -------------------------------------------------------- |
| Chart      | Full pie chart (default)                                 |
| Table      | Collapsible groups of sample tasks by status (paginated) |
| Split mode | Pie on top and the status table underneath               |

The board card stays on the pie view. In fullscreen, click a pie slice (or its
legend row) to jump to **Split mode** and show only that status group. Pick
another layout from the menu to clear the status focus. Large status groups
use the shared table pagination controls (rows per page / next-prev). Use **+**
on a status group to create a sample task in that status, or the row **⋯** menu
to edit — both open the shared work-item form. Changes are mock/session-only
and reset when you reload the page.

Sample data is local mock (~100 tasks) for UI work. Live charts are planned to
load from a precomputed snapshot (materialized view) so opening a board does
not re-run heavy queries for every filter or page change.

---

## Chart widget filters

For a **Chart** widget:

1. Select the **filter** icon on the widget header.
2. A fullscreen configuration window opens with **Advanced filters** already
   shown (Project and Where rows). Use **X** on a row to remove it (at least
   one row always remains). Changing the column updates the value options.
3. Select **Switch to quick filters** for the work-items-style field list
   (status, type, assignee, priority, project). Switch back with
   **Switch to advanced filters**.
4. Use **Type to filter** to search sample work items by title, status, type,
   priority, assignee, or project. Use the overlapped **assignee avatars** to
   the right of Filter to narrow the sample pie by person.
5. Use **Close** on the filter popover footer to dismiss without applying, or
   **Apply** to save filters to the widget.
6. Use the **split view** layout control in the fullscreen toolbar for Chart /
   Table / Split (does not change the board card).
7. Open **⋯** for Exit full screen, Rename, Duplicate, Export formats, or
   Delete (**Settings** is disabled for now).
8. Applied filters update the pie in fullscreen **and** on the board canvas.
   Toolbar search and assignee stay preview-only in fullscreen. **Save filters**
   (named presets) stays disabled until that lands later.

Other widget types do not use this filter flow yet.

---

## Related

- Feature notes for engineers: `docs/features/dashboard/CHARTS.md`
