# Dashboard overview

Your home screen under **Overview** — switch between a **productivity
dashboard** and a **slider of chart workspaces** you pin from Charts.

**Audience:** All users

---

## Open Overview

1. Sign in to Alice.
2. In the sidebar under **Platform**, select **Overview**.

You'll land on `/dashboard`.

---

## Customize Overview

Use the **Customize** control (sliders icon) to open a dialog where you can:

- Switch **Overview mode** between **Productivity** and **Chart workspaces**
- Under Chart workspaces, open a link to **customize the active board** on
  Charts
- Turn productivity widgets on or off

Your mode and widget choices are saved in this browser (local storage + cookie).

Overview defaults to **Productivity**. You can switch to **Chart workspaces**
anytime; if nothing is pinned yet, that mode shows a short tip and **Open Charts**.

---

## Productivity dashboard

A draggable, resizable home with frosted glass cards on a soft gradient. The
layout stays zoomable (browser zoom is not locked) and uses fluid padding so
common zoom levels stay comfortable. When you zoom in, the productivity
workspace scrolls so widget controls stay reachable. By default you get **Focus**
(Alice chat stays optional in Customize):

| Widget | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus  | One card with **Focus**, **Calendar**, and **Music** panes. Use the left/right chevrons in the top-right (before the drag handle) to switch; the last pane is remembered in this browser. **Focus** has a timer (5 minutes–8 hours, default 25) with compact play/pause controls, plus personal tasks you can reorder and filter with Active / Done / All tabs (Active opens by default). Duration, run/pause, remaining time, and tasks stay in this browser; a running timer continues after you leave and come back. When the timer finishes, the glass ring shows **Done** with an outward halo pulse, Overview shows a toast, and — if you allow browser notifications when you press Start — a system popup even if the tab is in the background. Reset or Start clears the Done state. **Calendar** is a personal month schedule on this device (not the project Board calendar): day cells show a green count pill (star when more than 9), the selected day list uses the same Active / Done / All tabs, a calendar icon jumps back to **today**, Tasks stay on the day you added them unless you delete them (bin). Focus mirrors incomplete **today** tasks (add / complete / delete); it does not move older days forward. **Music** keeps focus playlists from **Spotify**, **YouTube Music**, **Apple Music**, and **SoundCloud** in this browser. Paste a playlist URL and **Save**. When the link can be embedded, the pane shows a player preview. Use the toolbar **Maximize** control (left of **Picture in picture**) to expand the player; a soft liquid-glass **Minimize** stays on the player while expanded (Esc also exits). Switching to **Focus** or **Calendar** keeps the player mounted off-screen so audio can continue; return to **Music** to show it again. Use **Picture in picture** to open a floating Document PiP window that stays while you browse other Alice pages (supported browsers only); **Dock player** or **Close** returns it to the Music pane. Otherwise use **Open playlist**. Clear removes the saved URL for that provider. |

Turn on more widgets from **Customize**:

| Widget               | What it shows                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alice                | Quick chat on Overview. When models are connected, the header shows your preferred agent’s avatar and name (loaded on the server). Use the left/right chevrons to switch among available personalities; the choice is remembered in this browser. With no model, you only see the **Add an AI model first** gate — no personality avatar or chevrons |
| Categories           | One card for **Assigned to you**, **In progress**, and **Pending stories**. Use the left/right chevrons to switch; the last category is remembered in this browser                                                                                                                                                                                   |
| Work in progress     | Top five open assigned items, with a **% completed** pill for assigned Done                                                                                                                                                                                                                                                                          |
| Unread notifications | Latest unread alerts                                                                                                                                                                                                                                                                                                                                 |
| Your projects        | Projects you belong to                                                                                                                                                                                                                                                                                                                               |
| Docs                 | Search the user guide; open a page in a dialog                                                                                                                                                                                                                                                                                                       |

**Focus** starts on (with Calendar and Music as panes). **Alice**, **Work in
progress**, and **Unread notifications** start off; turn them on in
**Customize** when you want chat or the same lists Home shows.

**Chart workspaces** mode is always available. If nothing is pinned yet, that
mode shows a short tip and **Open Charts** instead of the slider.

Hold the ellipsis on a card to drag; resize from the bottom-right. Layout is
saved automatically.

---

## Chart workspace slider

Overview can also show chart workspaces marked **Show on dashboard** (with a
sort order) in the Charts registry. When none are pinned yet, Overview fills the pane (same full-bleed shell as
Productivity) with chart glyphs behind a compact tip card and **Open Charts**.
When
more than one board is pinned, use the slide tabs or arrows to switch. A single
pinned board shows without the slider.

On each slide you can:

- Drag and resize widgets on **your** boards (shared slides stay layout-locked)
- Drill into chart slices and open work items
- Use **Fullscreen** and **Export**

Filters, widget settings, Save option, duplicate, and delete stay on the Charts
board — Overview keeps a read-focused chrome. Open **Customize** → Chart
workspaces → **Customize active board** to edit the full board on
`/charts/[id]`.

### Pin and order boards

1. Open **Charts**.
2. On an **Active** row, open **⋯ → Edit**.
3. Turn on **Show on dashboard**.
4. Set **Dashboard order** (lower numbers appear earlier).

You can pin multiple workspaces. Sharing stays on **Views**; recipients can
**Fork** a shared board into their own copy from the board header.

### Design reference (mock grid)

The older mock overview (KPI cards, velocity, activity list) remains available
only at `/dashboard?mockOverview=1` for design reference. That URL will go away
once Numbers / velocity / activity chart widgets replace those mocks.

---

## From Overview

Use the sidebar to jump to **Charts**, **Board**, **Work Items**, **My Work**,
**Backlog**, or **Projects**. Use the header **bell** for notifications and
**Alice** for the AI assistant.

---

## Related

- [Charts](./charts.md)
- [Keyboard shortcuts](./keyboard-shortcuts.md)
- [Favorites and views](./favorites-and-views.md)
