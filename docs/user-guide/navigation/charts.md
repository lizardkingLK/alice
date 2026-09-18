# Charts

Build personal **chart workspaces** — drag-and-drop widget boards. The sidebar
opens your last-used workspace. You can save multiple workspaces, mark one for
Overview, and deep-link into a widget’s configuration.

**Audience:** All users

---

## Open Charts

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Charts**.

Alice opens `/charts`, then redirects to your **last opened** workspace
(`/charts/[id]`). If you have none yet, a default workspace is created.

---

## Workspaces

Each workspace is a named board of widgets.

### Switch or filter workspaces

1. Select the **filter** control on the Charts toolbar.
2. Filter by ownership (Mine / Shared) or status (Active / Archived).
3. Select a workspace in the list to open it (updates last-opened).

### Save or rename a workspace

1. Open the workspace **⋯** menu (next to the title), or open the filter dialog
   and choose **Save workspace**.
2. Confirm or edit the name (for example `Charts` or `Charts (2)`).
3. Optionally **Mark as overview** — only one overview workspace at a time;
   Overview will use it when that binding ships. Last-opened (sidebar) stays
   separate from the overview mark.

### Share a workspace

1. Open the workspace **⋯** menu.
2. Choose **Share**.
3. Pick a project (to load members), optionally a team, then select recipients.
4. Share syncs the workspace to the cloud (when available) and notifies
   recipients. Alice can also bookmark `/charts/[id]` in Views.

---

## Add workspace or widget

1. Select the **+** button (top right).
2. Choose **Add workspace**, enter a name (and optional overview mark), then
   **Create** — Alice opens the new empty board.
3. Or choose **Add widget** for the catalog on the **current** workspace.
4. Under Add widget, pick **Chart** (other types show **Coming soon**), or
   **More widgets** to browse the full catalog.

---

## Arrange the board

- Hold the **grip** on a widget to **drag** it
- Resize from the **bottom-right** corner
- Open the **⋯** menu for **Full screen**, **Rename**, **Duplicate**, or
  **Delete** (**Dock this widget** is disabled for now)

Chart widgets show a pie or donut. Layout modes (Chart / Table / Split) apply
only inside the fullscreen configuration window.

---

## Widget deep link

A URL like `/charts/[workspaceId]/widget/[widgetId]` opens that workspace and
the widget’s configuration dialog — useful for refresh or sharing a link to
edit a specific widget.

---

## Chart layout modes

Open a **Chart** widget in full screen (filter icon or **⋯ → Full screen**).
Use the **split view** button in the toolbar to choose:

| Layout     | What you see                                             |
| ---------- | -------------------------------------------------------- |
| Chart      | Full pie or donut chart (default)                        |
| Table      | Collapsible groups of sample tasks by status (paginated) |
| Split mode | Chart on top and the status table underneath             |

Click a pie slice (or legend row) to jump to **Split**. The table stays grouped
by **status**, scoped to the selected Labels slice (for example, Owner → only
that assignee’s New / To do / In progress groups). Pick another layout to clear
the slice focus.

### Widget settings

1. Select the **settings** (gear) button in the fullscreen toolbar.
2. Under **Chart type**, choose **Pie** or **Donut**. Other chart types show
   **Coming soon**.
3. Under **Labels** → **Columns**, choose how to group the chart: **Project**,
   **Group**, **Name**, **Owner**, **Status**, or **Due date**. The pie and
   legend update from the sample data right away. Selection is saved with the
   widget on this device (and with the workspace when cloud save is enabled).
4. **Values**, **Customize**, **Groups**, and **Choose which columns to show**
   are preview UI only for now.

The legend scrolls when there are many slices. Pie vs donut and Labels are saved
with the widget on this device (and with the workspace when cloud save is
enabled).

Chart values today may still use **sample data** while live work-item rollups
roll out. When live, slices reflect **counts** of work items (not story points
yet). Clicking a slice still opens the table scoped to that group.

---

## Chart widget filters

1. Select the **filter** icon on the widget header to open fullscreen config.
2. Use **Advanced** or **Quick** filters, search, and assignee avatars.
3. Dismiss the filter popover by clicking outside it, or **Close** / **Apply**.
4. Use layout, settings, and **⋯** as described above.

---

## Sharing (planned / API)

Workspaces can be shared using the same model as **Views**: recipients get
access to the chart board, and you can optionally bookmark `/charts/[id]` as a
saved view. Board layout is **not** stored inside Views.

---

## Related

- Feature notes: `docs/features/dashboard/CHARTS.md`
- Aggregation design: `docs/features/dashboard/CHARTS_AGGREGATION.md`
