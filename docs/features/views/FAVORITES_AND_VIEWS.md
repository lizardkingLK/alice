# Favorites and Views

Status: **Implemented** (IndexedDB upgrade still Plan-only)

Personal **Favorites** bookmark a page pathname (no query). **Saved Views**
snapshot pathname + query, live in Supabase, and can be shared / archived from
the `/views` workspace.

Related:

- Feature index: [README.md](./README.md)
- Dashboard shell: `apps/web/app/dashboard/_components/`
- Favorites storage: `apps/web/lib/favorites/`
- Views API: `apps/api/src/routes/api/savedViews/`
- Schema: `saved_views`, `saved_view_shares`

---

## Goals

- Star next to the breadcrumb last segment to toggle a Favorite (amber outline /
  solid).
- Layers icon beside the star opens **Save View** (title required, description
  optional).
- Sidebar **Favorites** group renders only when count &gt; 0 (collapsible; no
  group star icon). Favorite row icons follow a pathname → nav icon map
  (same icons as Platform / Projects / Help).
- **Views** is always a Platform nav item (Layers icon) that navigates to
  `/views` — no collapsible children list.
- Favorites open in the same tab.
- `/views` tabs: **My views** | **Shared with me** | **Archived**.
- Row actions: Open (new tab), Share, Archive / Restore (owner), Delete (shared).
- Share notifies recipients via in-app notifications.
- Opening a shared link still respects existing route RBAC.

## Non-goals

- Sharing Favorites
- Public / anonymous view links
- IndexedDB for Favorites at launch (upgrade path only — see below)
- Cross-org share outside project / team / project-member pickers

---

## Storage

### Favorites (client)

| Key                                        | Value                                              |
| ------------------------------------------ | -------------------------------------------------- |
| `alice:favorites:v1:{userId}`              | JSON array of `{ id, pathname, label, createdAt }` |
| `alice:favorites-sidebar-open:v1:{userId}` | JSON boolean — Favorites group expanded/collapsed  |

- Unique per **pathname** (query stripped).
- ~200 small entries fit comfortably in localStorage.
- **IndexedDB upgrade** (later): if quota errors or very large libraries appear,
  migrate the same shape into IndexedDB; keep the v1 key as a one-shot source.

### Views (Supabase)

| Table               | Role                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `saved_views`       | Owner title, description, pathname, search, optional `project_id`, `status` |
| `saved_view_shares` | `(view_id, user_id)` recipients                                             |

- **Uniqueness:** one **active** row per owner per `(pathname, search)` (partial unique
  index). Saving the same URL again updates title/description (same `id`, shares
  preserved). If only an archived row exists for that path, it is restored and updated.
- Soft archive: `status = archived` (same convention as projects/teams).
- `search` stores the query string **without** a leading `?`.
- RLS: owner full CRUD; recipients can **read** active views shared with them.

---

## URL rules

| Kind     | Stored            | Sidebar label                                                    |
| -------- | ----------------- | ---------------------------------------------------------------- |
| Favorite | pathname only     | Breadcrumb / page label (work-item detail → truncated **title**) |
| View     | pathname + search | View **title**                                                   |

Href for a view: `` `${pathname}${search ? `?${search}` : ''}` ``.

---

## Header UX

In dashboard page meta, after the last breadcrumb segment:

1. **Star** — toggle Favorite for current pathname.
2. **Layers** — open Save View dialog for current pathname + search.

Pass `favoriteLabel` (and optional `projectId`) from page shells when the
breadcrumb last segment is not a good label (e.g. work-item title).

---

## Sidebar UX

- **Favorites** — collapsible group (label only, chevron; no star on the group).
  Shown when count &gt; 0. Expanded/collapsed state persists in localStorage per
  user. Each item uses `resolveFavoriteNavIcon(pathname)` from the shared
  dashboard nav registry (`apps/web/lib/dashboard/nav-registry.ts`) and opens in
  the same tab. Truncate long labels with `TruncatedText`.
- **Views** — always shown as a Platform item (`/views`, Layers icon). Click
  navigates to the Views workspace (same tab). No sidebar children.

---

## `/views` workspace

Aligned with other registry list pages ([PERFORMANCE.md](../../guides/PERFORMANCE.md)):

- **SSR** — `RegistrySuspensePage` + `ViewsData` loads rows via Supabase in RSC
  (`getSavedViewsPaginated`) and project options for Share (`getProjectList`);
  mutations stay on `/api/saved-views`, then `router.refresh()`.
- **URL state** — `search`, `page`, `limit`, and `tab` (`mine` | `shared` |
  `archived`) via `searchParams` (debounced search, pagination controls).
- **Skeleton** — `loading.tsx` / Suspense use `REGISTRY_PAGES.views`.
- **Columns** — optional visibility (title required) in localStorage
  `alice:views-table-columns:v1:{userId}`.

| Tab            | Contents                                  |
| -------------- | ----------------------------------------- |
| My views       | Owner’s active views                      |
| Shared with me | Active views shared with the current user |
| Archived       | Owner’s archived views                    |

### Share dialog

Project + team comboboxes filter recipients; checkboxes are the source of truth.
Projects come from SSR props; members/teams load via server action
`fetchShareViewProjectScope` (direct Supabase, not Express).

1. **Project** — searchable; locked when the view already has `project_id`.
2. **Team** — optional; teams for the selected project. Changing project or team
   **replaces** the checkbox selection (project → all members; team → that
   team’s members).
3. **Recipients** — project-member checkboxes (owner excluded); fine-tune before
   Share.

Submit upserts `saved_view_shares` by `(view_id, user_id)` and notifies only
**new** recipients. Re-share is idempotent for existing shares.

### Archive and delete

- **My views → Archive** soft-archives the owner’s view (`status = archived`).
- **Shared with me → Delete** removes only the recipient’s share row (owner’s
  view unchanged). The row leaves Shared with me; re-share can recreate it.
- **Archived → Restore / Delete** restores the owner’s view or hard-deletes it
  (share rows cascade). Shared-with-me only lists active shares of active views.

---

## Notifications

New `NotificationType` value: `view_shared`. Message names the view title and
sharer; `related_item_id` = **saved view id** (not a work item). Inbox click
loads the view’s `pathname` + `search` and navigates there; missing/archived
views fall back to `/views?tab=shared`.

---

## Phases

1. Docs (this file)
2. Favorites (localStorage + star + sidebar)
3. Views core (schema, API CRUD, Save dialog, sidebar, My + Archived)
4. Share + notify + Shared with me
5. Polish / IndexedDB upgrade only if needed

## Tests

- Unit: favorites serialize/strip/dedupe; `resolveFavoriteNavIcon` prefix map;
  view URL normalize; share recipient expansion; Views column visibility
  storage; `parseViewsListTab`
- Component: star, save dialog, share modes; sidebar Favorites collapsible;
  Platform Views link always present
- API: CRUD auth, archive, share + notification create
- Sidebar RBAC suite extended for Favorites visibility / Views always-on
- Views registry: SSR list + URL search/tab/pagination (covered via helpers +
  workspace wiring)
