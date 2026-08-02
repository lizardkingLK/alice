# Optimistic locking & conflict recovery

Concurrent edits use row-level optimistic locking on the existing `updated_at`
audit column (no separate version integer). When a write races, the API returns
**409** with code `OPTIMISTIC_LOCK` and the current server row; the web app
opens a global conflict dialog so the user can review, keep their fields, or
take the server version.

Related:

- [`../../database/AUDIT_COLUMNS.md`](../../database/AUDIT_COLUMNS.md) — `updated_at` is also the lock token
- [`../work-items/README.md`](../work-items/README.md) — highest-collision surface (details, board, backlog)

---

## Lock contract

1. Client loads an entity including `updated_at` (or sprint `updatedAt`).
2. While fields are dirty, pending edits may be flushed to `localStorage` every
   **5s** (same cadence as description autosave).
3. Mutations send `expectedUpdatedAt` equal to the last known timestamp.
4. Repositories update with `.eq('id', …).eq('updated_at', expectedUpdatedAt)`
   and still apply `auditUpdate` (new `updated_at`).
5. Zero matching rows → fetch current row → **409**
   `{ code: 'OPTIMISTIC_LOCK', error, serverEntity }`.

Granularity is **one check per row**: any concurrent change to the row
conflicts, even if different fields were edited.

---

## Conflict dialog actions

| Action                   | Behavior                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Review / Apply merge** | Per-field Mine vs Theirs, then re-PATCH chosen fields with the server’s current `updated_at` |
| **Keep mine**            | Force-apply all pending fields using the server timestamp as the new base                    |
| **Take theirs**          | Discard pending localStorage; reload UI from `serverEntity`                                  |

Closing the dialog (X / Escape) discards pending edits (**Take theirs**).
Refreshing or revisiting preserves pending edits when `baseUpdatedAt` still
matches the server `updated_at`, and discards them only when those timestamps
differ (stale base → treat as **Take theirs**).

---

## Pending localStorage shape

Key: `alice:optimistic-pending:{entityType}:{entityId}:{userId}`

```ts
{
  entityType: 'work_item' | 'comment' | 'project' | …,
  entityId: string,
  userId: string,
  baseUpdatedAt: string,
  pendingFields: Record<string, unknown>, // dirty fields only
  savedAt: string
}
```

Cleared on successful save, **Take theirs**, dialog dismiss, or a refresh/revisit
when pending `baseUpdatedAt` is stale vs the fresh server `updated_at`.

---

## Code map

| Layer               | Location                                |
| ------------------- | --------------------------------------- |
| Shared types / code | `packages/types/src/optimistic-lock.ts` |
| API helper          | `apps/api/src/lib/optimistic-lock.ts`   |
| Client pending util | `apps/web/lib/optimistic-lock/`         |
| Global UI           | `apps/web/components/optimistic-lock/`  |

---

## Non-goals (v1)

- Per-field DB versions / CRDT / realtime merge
- Silent auto-merge without confirmation
- Changing audit column semantics beyond using `updated_at` as the lock predicate
