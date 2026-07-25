# Work-item attachments

Status: **Plan**

Private Storage attachments on work-item details: SSR metadata with the page,
signed preview/download URLs minted on demand, client-side URL cache with
**explicit** regenerate (no auto-refresh on expiry).

Related:

- Feature index: [README.md](./README.md)
- Performance: [PERFORMANCE.md](../../guides/PERFORMANCE.md) §2.4, §2.9, §3
- Profile / public avatars (separate): [EDIT_PROFILE.md](../profile/EDIT_PROFILE.md)
- Schema: `attachments` in `packages/db/prisma/schema.prisma`
- Storage: `alice_storage_attachments` (**private**), shared `apps/api/src/lib/file-helpers.ts`

---

## Goals

- Replace `PLACEHOLDER_ATTACHMENTS` on `/work-items/[id]` with real rows.
- List metadata only in RSC (no signed URLs on first paint).
- Mint signed URLs when the user opens an attachment; cache in memory; regenerate
  only via an explicit control when the link stops working.
- Uploads/deletes go through the Express API; list reads follow PERFORMANCE.md
  (prefer RSC / server reader, not Express GET on the hot path).

## Non-goals

- SSR-minting signed URLs for every attachment on page load
- Auto re-mint when a signed URL expires
- TipTap / document JSON for binary files
- Persisting signed URLs in `localStorage` / cookies
- Image thumbnail transforms (later)
- Changing public profile-picture bucket behavior

---

## Locked decisions

| Topic            | Decision                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Bucket           | `alice_storage_attachments` — **private**                                                                                   |
| DB row           | Store `storage_path` (+ name, mime, size, uploader); **never** a forever public file URL                                    |
| Initial load     | Same pattern as discussion: parallel RSC loader next to `getWorkItem`                                                       |
| Join vs parallel | **Parallel** `getWorkItemAttachments(id)` — do **not** embed attachments (or comments) in a single mega `work_items` select |
| List UI          | Type icon + name + size; no private `<img src>` thumbnails in v1                                                            |
| Signed URL       | Mint on click via authenticated API (`createSignedUrl`)                                                                     |
| Client cache     | In-memory `Map` per details visit: `{ previewUrl, downloadUrl, expiresAt? }`                                                |
| Expiry           | No automatic refresh; show expired state + **Generate new link** / **Refresh link**                                         |
| Viewer           | Alice modal: image / PDF when possible + Download; else download-only                                                       |

```mermaid
flowchart TD
  rsc["WorkItemDetailsData RSC"]
  rsc --> wi["getWorkItem"]
  rsc --> comments["getWorkItemDiscussion"]
  rsc --> atts["getWorkItemAttachments"]
  atts --> props["attachments props metadata only"]
  props --> click["User clicks card"]
  click --> cacheHit{"In-memory cache hit?"}
  cacheHit -->|yes| tryUse["Use cached URLs"]
  cacheHit -->|no| mint["GET/POST attachments/:id/url"]
  mint --> store["Cache URLs"]
  tryUse --> ok{"Preview works?"}
  ok -->|yes| viewer["Modal preview + download"]
  ok -->|no| expired["Expired UI + Generate new link"]
  expired --> mint
```

---

## Data loading (like comments — not a complex join)

**Prefer** the existing details fan-out:

```ts
const [workItem, initialComments, initialAttachments, dbUser] =
  await Promise.all([
    getWorkItem(workItemId),
    getWorkItemDiscussion(workItemId),
    getWorkItemAttachments(workItemId), // NEW — *.service.server.ts
    getDbUser(),
  ]);
```

### Why not one Supabase join of work item + comments + attachments?

| Concern                | Parallel loaders                                     | Mega-join                                              |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Shape                  | Comments (threaded tree) ≠ flat attachments          | Awkward nested select + client reshape                 |
| Failure isolation      | One `safeServerFetch` can fail soft                  | One bad embed can fail the whole details payload       |
| Caching / invalidation | Revalidate or refresh one domain                     | Coarser invalidation                                   |
| Query cost             | Three focused queries (already the comments pattern) | Large payload even when UI only needs one section      |
| PERFORMANCE.md         | Matches §2.9 discussion SSR                          | Optional later if profiling proves one round trip wins |

**Do not merge comments into the same join** for the same reasons. Keep
`getWorkItemDiscussion` and `getWorkItemAttachments` as siblings.

Ideal for attachments list: **direct Supabase** in
`attachments.service.server.ts` (PERFORMANCE §2.4), mirroring the API repository
select. Discussion today still goes through the comments API helper; new
attachment reads should prefer the direct-server path from day one.

---

## API sketch (mutations + signed URL)

| Endpoint                                   | Role                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET /api/attachments/:id/url` (or `POST`) | Auth + project access → `{ previewUrl?, downloadUrl, expiresAt }`                          |
| `POST /api/attachments`                    | Upload to attachments bucket (signed URL in response); later also insert `attachments` row |
| `DELETE /api/attachments/:id`              | Remove/archive row + best-effort Storage delete                                            |

Optional `GET /api/attachments?work_item_id=` for non-web clients — **not** the
hot path for `/work-items/[id]` first paint.

Reuse `apps/api/src/lib/file-helpers.ts` for upload / signed URL / remove.

---

## Web UI

1. **List** — replace placeholders; props from RSC.
2. **Click** — if cache has URLs, try them; else mint and cache.
3. **Expired** — broken preview / 403 → message + explicit regenerate (overwrite cache).
4. **Add** — wire Plus → upload mutation → `router.refresh()` (or local append after success).

---

## Phased rollout

| Section | Work                                                                                                  | Status           |
| ------- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| 0       | This document + work-items README index                                                               | Done when landed |
| 0b      | Rename `/api/files` → `/api/attachments`; shared `file-helpers.ts`; `/files` UI posts to new endpoint | Done             |
| 1       | `getWorkItemAttachments` server reader + wire into `WorkItemDetailsData`                              |                  |
| 2       | API signed-url (+ upload/delete) via `file-helpers`                                                   |                  |
| 3       | Attachment cards + in-memory URL cache + regenerate control                                           |                  |
| 4       | Preview modal + download                                                                              |                  |
| 5       | Add-attachment upload from details                                                                    |                  |

---

## Implementation pointers

| Area                      | Path                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Details RSC               | `apps/web/app/work-items/[id]/_components/work-item-details-data.tsx`                |
| Details UI                | `apps/web/app/work-items/_components/workItem-details.tsx`                           |
| Discussion pattern        | `apps/web/app/comments/_services/comments.service.server.ts`                         |
| Attachments server reader | `apps/web/app/…/attachments.service.server.ts` (to add)                              |
| Storage helpers           | `apps/api/src/lib/file-helpers.ts`                                                   |
| Attachments API           | `apps/api/src/routes/api/attachments/` (`POST /` upload today; signed-url/CRUD next) |
