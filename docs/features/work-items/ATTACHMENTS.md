# Work-item attachments

Status: **Implemented** (Part 2 §§0–5)

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
  wi["getWorkItem"]
  comments["getWorkItemDiscussion"]
  atts["getWorkItemAttachments"]
  props["attachments props metadata only"]
  userClick["User clicks card"]
  cacheHit{"In-memory cache hit?"}
  tryUse["Use cached URLs"]
  mint["GET/POST attachments/:id/url"]
  store["Cache URLs"]
  ok{"Preview works?"}
  viewer["Modal preview + download"]
  expired["Expired UI + Generate new link"]

  rsc --> wi
  rsc --> comments
  rsc --> atts
  atts --> props
  props --> userClick
  userClick --> cacheHit
  cacheHit -->|yes| tryUse
  cacheHit -->|no| mint
  mint --> store
  tryUse --> ok
  ok -->|yes| viewer
  ok -->|no| expired
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

## API (mutations + signed URL)

All routes are also mounted at `/api/v1/attachments` (same router instance).

| Endpoint                               | Role                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/attachments?work_item_id=`   | **Unused by Next** — Prisma list of active attachment metadata for a work item (escape hatch; RSC still uses supabase-js). Requires project membership.                                     |
| `GET /api/attachments/:id`             | Auth → `{ previewUrl, downloadUrl, expiresAt }`. Verifies the Storage object exists first — returns **410** when the row is orphaned (object gone). `404` when the row is missing/archived. |
| `POST /api/attachments/upload-session` | Mint a direct-to-Supabase upload session (JSON metadata only).                                                                                                                              |
| `POST /api/attachments/finalize`       | Commit DB row after browser upload completes.                                                                                                                                               |
| `POST /api/attachments`                | Upload to attachments bucket. Optional multipart `work_item_id` also inserts an `attachments` row (returns the row). Without it, storage-only (`/files` playground).                        |
| `DELETE /api/attachments/:id`          | Archive row (`status: 'archived'`) + best-effort Storage delete                                                                                                                             |

> The URL endpoint is `:/id` (not `/:id/url`) to match the `:id` resource convention used by other features.

Reuse `apps/api/src/lib/file-helpers.ts` for upload / signed URL / existence check / remove.

---

## Web UI

1. **List** — real rows; props from RSC.
2. **Click** — if cache has URLs, try them; else mint and cache.
3. **Expired** — broken preview → message + explicit regenerate (overwrite cache).
4. **Gone (410)** — object missing → distinct "no longer available" state + **Remove attachment** (regenerate is hidden, since re-minting can't recover a deleted object).
5. **Add** — top **Attach** button and section **+** both open a shared multi-file `Dropzone` dialog → sequential upload → local append + `router.refresh()`.

---

## Phased rollout

| Section | Work                                                                                                  | Status           |
| ------- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| 0       | This document + work-items README index                                                               | Done when landed |
| 0b      | Rename `/api/files` → `/api/attachments`; shared `file-helpers.ts`; `/files` UI posts to new endpoint | Done             |
| 1       | `getWorkItemAttachments` server reader + wire into `WorkItemDetailsData`                              | Done             |
| 2       | API signed-url (+ upload/delete) via `file-helpers`                                                   | Done             |
| 3       | Attachment cards + in-memory URL cache + regenerate control                                           | Done             |
| 4       | Preview modal + download                                                                              | Done             |
| 5       | Add-attachment upload from details                                                                    | Done             |

---

## Implementation pointers

| Area                          | Path                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Details RSC                   | `apps/web/app/work-items/[id]/_components/work-item-details-data.tsx`                                          |
| Details UI                    | `apps/web/app/work-items/_components/workItem-details.tsx`                                                     |
| Attachments section (UI)      | `apps/web/app/work-items/_components/work-item-attachments-section.tsx`                                        |
| Upload dialog (multi-file)    | `apps/web/app/work-items/_components/work-item-attachment-upload-dialog.tsx`                                   |
| Client ApiError (status)      | `apps/web/lib/api/api.ts` (`ApiError` carries HTTP status for 410 branching)                                   |
| Discussion pattern            | `apps/web/app/comments/_services/comments.service.server.ts`                                                   |
| Attachments shared read types | `packages/types/src/attachments.ts` (`AttachmentWithUploader`, `ATTACHMENT_SELECT`)                            |
| Attachments v1 wire DTOs      | `packages/types/src/api/v1/attachments.ts` (Zod inputs/responses + Prisma `attachmentListSelect`)              |
| Attachments server reader     | `apps/web/app/work-items/_services/workItem-attachments.service.server.ts`                                     |
| Attachments client API        | `apps/web/app/work-items/_services/workItem-attachments.service.client.ts`                                     |
| Storage helpers               | `apps/api/src/lib/file-helpers.ts`                                                                             |
| Attachments API               | `apps/api/src/routes/api/attachments/` (`GET /`, `GET /:id`, upload session/finalize, `POST /`, `DELETE /:id`) |
