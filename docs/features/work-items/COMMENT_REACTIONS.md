# Comment reactions

| Field  | Value                                               |
| ------ | --------------------------------------------------- |
| Status | **Living**                                          |
| Scope  | Discussion comments on work items and Comments page |

Emoji reactions on discussion comments. **Like** is not a separate type — `👍`
is the default emoji in a single reaction control.

## Storage

`comments.reactions` is a JSONB array of `{ user_id, emoji }` with default `[]`.
Counts are **not** stored; the API/UI derive summaries with
`summarizeCommentReactions` from `@repo/types`.

Allowlist: `COMMENT_REACTION_EMOJIS` in `packages/types/src/comment-reactions.ts`.

## Concurrency

- **Reactions** use lock-free merge (`add` / `remove` of one user+emoji pair)
  via `POST /api/comments/:id/reactions`. No `expectedUpdatedAt`.
- **Server** merges via Prisma `findUnique` + `updateMany` with
  `mergeCommentReaction` (no interactive `FOR UPDATE` tx, no `$queryRaw` —
  tagged raw params bind as Postgres `unknown` and break `->>` /
  `jsonb_build_object`).
- **Client** serializes per-comment flushes and coalesces net desired membership
  while a POST is in flight (`comment-reaction-mutation-queue.ts`) — same idea
  as the work-item sidebar mutation chain / board pending. Optimistic chips
  update immediately; the next network call waits for the **HTTP** settle, not
  realtime. Failures reconcile to last ack (no inverse-toggle rollback).
- While a flush is pending, realtime UPDATEs keep local `reactions` so echoes
  do not clobber optimistic chips. Other fields still merge.
- **Honest UI:** a small spinner next to chips while that comment’s flush is
  in flight. Pending flushes also arm the native `beforeunload` leave prompt
  (custom app dialogs are not allowed for hard refresh/close) plus a
  `pagehide` / unmount `keepalive` flush. Refresh can still drop work that
  never left the browser.
- **Content edits** still use optimistic locking.
- Reactor names resolve from the cached comment users / project members list.

This client serial/coalesce pattern is the right fix for spammy optimistic
realtime UIs generally (board DnD, backlog, calendar due-dates). Prefer it over
a Redis/Bull message queue for per-user interaction bursts **for now**. A
future Redis write-behind is sketched in
[REALTIME_DISCUSSION.md](./REALTIME_DISCUSSION.md#future-redis-write-behind).

## UI

- Reaction chips (emoji + count; highlighted when the viewer reacted).
- Hover a chip for reactor names from the cached members list.
- One **Add reaction** (`SmilePlus`) picker — small curated set, no full emoji dump.
- Footer timestamp: humanized relative time; hover shows absolute date/time.

## Related

- User guide: [Comments and activity](../../user-guide/work-items/comments-and-activity.md)
- Realtime: [REALTIME_DISCUSSION.md](./REALTIME_DISCUSSION.md)
