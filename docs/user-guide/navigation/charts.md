# Charts

Build personal **chart workspaces** — drag-and-drop widget boards. The sidebar
opens the Charts registry. You can save multiple workspaces, mark one for
Overview, and deep-link into a widget’s configuration. Workspaces sync to your
account. Boards are stored on the server — this device does not keep a local
copy of workspace layout.

**Audience:** All users

---

## Open Charts

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Charts**.

Alice opens the **Charts registry** at `/charts`. From there, open a workspace
board (`/charts/[id]`). If you have no workspaces yet, the registry shows a
centered prompt: _To customize charts, create a new workspace._ with
**Create Workspace**. Alice does not invent a default workspace for you.

---

## Workspaces registry

The registry lists **your** workspaces with search on the left and tabs on the
right (same bordered tab pattern as **Views**, but Charts has no Shared tab).

### Switch or filter workspaces

1. On `/charts`, use the tabs:
   - **Active** — your active boards
   - **Archived** — your soft-hidden boards
2. Optionally search by title.
3. Select a workspace title to open its board (updates last-opened).

Tab / search / page changes stay on this page (they do not reload the whole
shell).

### Create a workspace

1. Select **Create Workspace** (toolbar or empty-state CTA).
2. Enter a name and optional overview mark, then create — Alice opens the new
   empty board.

### Save or rename a workspace

1. Open a workspace board, then open the board **⋯** menu and choose
   **Rename / Save**.
2. Confirm or edit the name (for example `Charts` or `Charts (2)`).
3. Optionally **Mark as overview** — only one overview workspace at a time;
   Overview will use it when that binding ships. Last-opened stays separate
   from the overview mark.

### Share a workspace

Charts does **not** have a native Share action. To share a board:

1. Open the workspace board.
2. In the dashboard header, choose **Save view** and name the bookmark.
3. Open **Views**, find that view, and use **Share** there.

Recipients open the board from **Views → Shared with me** (or the inbox link).
Alice grants board access (`chart_shares`) when you share a chart-backed view.

### Archive, restore, or delete a workspace

Owned workspaces follow the same lifecycle as **Views**:

1. Open the registry row **⋯** menu or the board **⋯** menu.
2. On an **active** owned workspace, choose **Archive** to soft-hide it. Find
   it again under the **Archived** tab.
3. On an **archived** owned workspace, choose **Restore** to bring it back.
4. Choose **Delete** at any time (active or archived) to remove it permanently
   after confirming. Permanent delete also removes share records for that board.
5. If someone shared a board with you (via Views) and you still have access,
   **Leave** on the board removes only your chart access.

After delete or leave from a board, Alice returns to the registry. Empty
**Active** shows the create prompt again.

---

## Board toolbar

On `/charts/[id]`:

- **All workspaces** returns to the registry
- **Defaults** (same as Board / Work items) seeds filters for new Chart widgets
- **+** adds a widget or creates another workspace

---

## Add widget

1. On a board, select the **+** button.
2. Choose **Add widget** for the catalog on the **current** workspace.
3. Under Add widget, pick **Chart** (other types show **Coming soon**), or
   **More widgets** to browse the full catalog.

---

## Arrange the board

- Hold the **grip** on a widget to **drag** it
- Resize from the **bottom-right** corner
- Open the **⋯** menu for **Full screen**, **Rename**, **Duplicate**, or
  **Delete** (**Dock this widget** is disabled for now)

Chart widgets show a pie, donut, or bar chart. Layout modes (Chart / Table /
Split) apply only inside the fullscreen configuration window.

---

## Widget deep link

A URL like `/charts/[workspaceId]/widget/[widgetId]` opens that workspace and
the widget’s configuration dialog — useful for refresh or sharing a link to
edit a specific widget.

---

## Chart layout modes

Open a **Chart** widget in full screen (filter icon or **⋯ → Full screen**).
Use the **split view** button in the toolbar to choose:

| Layout     | What you see                                           |
| ---------- | ------------------------------------------------------ |
| Chart      | Full pie, donut, or bar chart (default donut)          |
| Table      | Collapsible groups of work items by status (paginated) |
| Split mode | Chart on top and the status table underneath           |

Click a pie slice (or legend row) on the **board** or in full screen to open
the widget config in **Split**, with the table scoped to that Labels slice.
The table stays grouped by **status** in board order (New → To do → In
progress → Testing → Done). Status groups with no matching rows are hidden.
Toolbar search (task title or assignee) keeps that order among matches and
expands the groups that still have items.

Pick another layout to clear the slice focus.

### Widget settings

1. Select the **settings** (gear) button in the fullscreen toolbar.
2. Under **Chart type**, choose **Pie**, **Donut**, or **Bar**. Other chart
   types show **Coming soon**.
3. Under **Labels** → **Columns**, choose how to group the chart: **Project**,
   **Owner**, **Status**, **Type**, or **Priority**. The chart and legend update
   from live work-item counts.
4. Under **Values**, charts use **Count items** only (other calculations are
   coming later).
5. Under **Customize**, choose **Value** or **%**, sort slices, and optionally
   show empty values. **Slice colors** lets you pick a theme swatch per slice;
   changing **Labels → Columns** resets colors to the defaults. Use
   **Reset colors** to clear custom swatches without changing Labels.
6. Under **Choose which columns to show**, pick which drilldown table columns
   appear. **Task**, **Owner**, **Status**, **Type**, **Priority**, and
   **Actions** are on by default; **Project** and **Sprint** are available but
   off until you enable them. **Actions** → **Open** goes to the work item
   page; **Edit** opens the same edit dialog used elsewhere. Saving an edit
   refreshes the chart and table from live data.
7. **Groups** is **Coming soon** (empty status groups are already hidden in the
   table).

The legend scrolls when there are many slices. Settings are saved with the
widget and workspace.

Chart slices reflect **counts** of work items (not story points yet). Filters
default to **All projects** (or your saved workspace defaults). Clicking a
slice opens the table scoped to that group.

---

## Workspace defaults

Charts uses the same **Defaults** control as Board and Work items (on the board
toolbar). Save a default **project** (including **All projects**) and optional
**sprint**. New Chart widgets you insert inherit those filters. Existing widgets
keep their own filters until you change them.

---

## Chart widget filters

1. Select the **filter** icon on the widget header to open fullscreen config.
2. Choose **All projects** or a specific **project** (Quick filters opens on
   **Project** by default). Optionally pick a **sprint** for that project
   (disabled until a single project is selected). Use **Assignee** (and other
   fields) in Quick / Advanced filters. The toolbar search filters the table by
   task title or assignee name after a slice click.
3. In **Advanced**, project and sprint sit above the rule rows. Each column
   (Status, Type, …) can appear at most once — two “Status is …” rows cannot
   both be true under AND.
4. Dismiss the filter popover by clicking outside it, or **Close** / **Apply**.
5. Use layout, settings, and **⋯** as described above.

---

## Sharing

Share boards through **Views**, not the Charts registry:

1. **Save view** on `/charts/[id]` (header) creates a Views bookmark (typed as
   a chart resource when the path is a workspace board).
2. **Share** that view from `/views` — Alice also grants `chart_shares` so the
   recipient can open the board.
3. Recipients use **Views → Shared with me** (Charts has no Shared tab).

Board layout stays in **`charts.board_json`**, not inside Views.

---

## Related

- [Views](./views.md)
- Feature notes: `docs/features/dashboard/CHARTS.md`
