# Realtime board moves (W6)

| Field        | Value                                                                               |
| ------------ | ----------------------------------------------------------------------------------- |
| Status       | **Living**                                                                          |
| Last updated | 2026-10-17                                                                          |
| Scope        | Kanban status / column moves, client prefs, realtime confirm, toasts                |
| Performance  | [PERFORMANCE.md §9 W6](../../guides/PERFORMANCE.md#w6--async--realtime-board-moves) |

Non-blocking board transitions: local placement first, PATCH in the background,
shared truth over Supabase realtime. Complements the W5 status fast path
(~4.6s warm PATCH) by removing **perceived** wait on the drag gesture.

## Goals

1. Drag feels instant (already optimistic); UI does **not** await PATCH.
2. Own and others’ moves converge via **channel / server row** (commit order wins).
3. Conflicts use a **toast**, not the field-merge optimistic-lock dialog.
4. Members can fall back to today’s await/static board via a local preference.

## Non-goals (v1)

- Fire-and-forget that aborts the HTTP request before the API finishes (Vercel
  must still `await` write + activities).
- Replacing `work_items` realtime with notifications as the **only** sync bus.
- Changing full-field PATCH merge dialogs (title, etc.) — those stay as today.

## Preferences (localStorage)

Board settings menu (layout control, gear / grid icon):

| Key                                         | Values                 | Default              | Effect                                                                                                                                 |
| ------------------------------------------- | ---------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `alice:board-sync:v1:<userId>` → `syncMode` | `realtime` \| `static` | `realtime`           | Realtime: background PATCH + channel merge; cards stay undimmed while saving. Static: same PATCH path with pending dim; no live merge. |
| same → `subscribeStatusEvents`              | `true` \| `false`      | `true` when realtime | Subscribe to `work_items` UPDATE for the open board (project-filtered when a project is selected).                                     |

**Deferred (v1):** silent status/move notifications for the inbox
(`statusEventsInInbox`). Board sync does **not** require notification inserts.

## Execution model

```text
Drag
  → push pending attempt (per work-item id + attemptId)
  → local place card
  → PATCH status fast path in background (do not await in drag handler)

On channel work_items update (newer updated_at)
  → apply row to board
  → clear matching pending / drop losing attempts

On background PATCH result
  → 2xx: dedupe with channel echo (same id + updated_at)
  → 400 / 403 invalid: toast (existing Move blocked) + revert that attempt from pending stack
  → 409 lock: toast (“Someone else moved this item”) + rebase to serverEntity / channel row
     (no keep-mine / merge dialog)
```

### Concurrent members (A then B on the same card)

1. Whoever’s PATCH **commits first** owns the DB row.
2. Loser’s PATCH gets **409** (stale `updated_at`).
3. Both clients apply the winner via **channel**; loser also gets lock toast.
4. Rebase to channel/server entity — do **not** blindly restore pre-drag if a
   newer placement already arrived.

Same destination twice: still settle on one commit; second client toasts once.

## Pending stack

- Keyed by **work-item id** (and client `attemptId`) so multi-card drags do not
  undo each other.
- Stores prior `status` / `board_column_id` / `updated_at` for revert.
- Cleared on success echo, channel overwrite, or explicit failure handling.

## Realtime source of truth

**Primary (shipped):** Supabase realtime on `work_items` UPDATE via
`useBoardWorkItemsRealtime` (status, `board_column_id`, `updated_at`;
`project_id` filter when the board URL has a concrete project).

**Publication (required):** `public.work_items` must be in the
`supabase_realtime` publication or clients receive no events. Migration:
`packages/db/prisma/migrations/add_work_items_realtime_publication/`. Verify:

```sql
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename = 'work_items';
```

**Deferred:** optional `silent` notifications for inbox-pipeline reuse — see
[notifications](../notifications/README.md).

## Outcome matrix (realtime mode)

| Result             | UI                                                            |
| ------------------ | ------------------------------------------------------------- |
| Success            | Card already placed; channel/PATCH confirm; activity as today |
| Invalid transition | Existing validation toast + revert that pending attempt       |
| Optimistic lock    | Toast (not dialog) + live board = winner’s row                |

## Static mode

- Await PATCH in the move handler (current behavior).
- No live merge from others’ moves (until refresh/navigation).
- Lock/validation UX can stay closer to today; prefer toast-for-409 on board
  moves eventually for consistency.

## API / schema notes (draft)

- Reuse W5 `updateWorkItemStatus` / status-placement-only PATCH.
- Background client still **reads** status/body for 4xx/409 (non-blocking ≠
  ignore errors).
- If `silent` is added on `notifications`: migration + inbox list filter +
  types; document in [notifications](../notifications/README.md).

## Shipped surface

| Piece         | Location                                                        |
| ------------- | --------------------------------------------------------------- |
| Prefs storage | `apps/web/app/board/_helpers/board-sync-storage.ts`             |
| Prefs hook    | `useBoardSyncPrefs`                                             |
| Menu toggles  | `BoardLayoutMenu` (Realtime / Static + Subscribe to moves)      |
| Pending stack | `board-move-pending.ts` + kanban `pendingAttempts`              |
| 409 toast     | `board-move-conflict-toast.ts` (no merge dialog on board moves) |
| Channel       | `useBoardWorkItemsRealtime`                                     |
| Publication   | `add_work_items_realtime_publication` migration                 |

**Still deferred:** silent inbox notifications (§ Non-goals / prefs).

**Test tip:** use `/board` (same project filter, Realtime + Subscribe on) in two
browsers — not `/dashboard`. Dashboard charts/inbox do not subscribe to board
moves.

## Measure

- Perceived: drag returns before PATCH completes (no spinner on card for wait).
- Warm PATCH TTFB still ~W5 (~4–5s) in Network — expected; UX should not block.
- Conflict: two browsers, same card → one toast + one final column.

## Related

- [PERFORMANCE.md](../../guides/PERFORMANCE.md) — W5–W7 done; W7 reuses this pattern for backlog + calendar DnD
- Shared client: `apps/web/lib/work-items/use-work-items-realtime.ts`, `apply-realtime-work-item-row.ts`
- [REALTIME_DISCUSSION.md](../work-items/REALTIME_DISCUSSION.md) — planned details-tab feeds (after M8)
- [Kanban user guide](../../user-guide/board-and-planning/kanban-board.md)
- [Notifications](../notifications/README.md) — silent inbox still planned
- Optimistic locking (field merges): [optimistic-locking](../optimistic-locking/README.md) — board moves use toast, not that dialog
