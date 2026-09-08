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
2. Choose a quick option from the menu (for example **Chart**, **Numbers**, or
   **Gantt**).

The widget appears on the board right away. You can add the same type more than
once.

---

## Browse Widgets

1. Open **Add Widget**.
2. Select **More widgets** at the bottom of the menu.
3. Browse categories in the left sidebar, or use **Search**.
4. On a widget card, select **Add widget**.

You can add the same widget type more than once — each placement is a separate
instance (for example two Numbers widgets with different filters later).

---

## Arrange the board

- Hold the **grip** on the left of a widget to **drag** it
- Resize from the **bottom-right** corner
- Open the **⋯** menu for **Full screen**, **Rename**, **Duplicate**, or
  **Delete** (**Settings** and **Dock this widget** are disabled for now)
- Use **Clear board** to remove all widgets on this device

Layout is saved in the browser for now. Cloud save and shareable chart boards
are coming later.

---

## Chart widget filters

For a **Chart** widget (sample title **Tasks by status** when untitled):

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
5. Open **⋯** for Exit full screen, Rename, Duplicate, Export formats, or
   Delete (**Settings** is disabled for now).
6. Select **Apply** to update the pie in fullscreen **and** on the board
   canvas. Applied filters are stored with the widget in local board data
   (reload-safe). Toolbar search and assignee stay preview-only in fullscreen.
   **Save filters** (named presets) stays disabled until that lands later.

Other widget types do not use this filter flow yet.

---

## Related

- [Dashboard overview](./dashboard-overview.md)
- [Favorites and views](./favorites-and-views.md)
