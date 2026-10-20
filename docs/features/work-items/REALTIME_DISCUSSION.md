# Realtime discussion feeds

| Field       | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Status      | **Living**                                                                                    |
| Scope       | Work-item details tabs: Discussion (comments), Activity, Work Log — live sync without refresh |
| Sequencing  | After **W7** and **M8** first slice — see PERFORMANCE.md §9                                   |
| Performance | Linked from [PERFORMANCE.md](../../guides/PERFORMANCE.md); **not** a §9 write-latency ID      |

Work-item details loads comments / activities / work logs in the initial RSC
payload. Registry and board **`router.refresh()`** paths do **not** reload those
feeds. While `/work-items/[id]` is open, Alice subscribes to Supabase
`postgres_changes` so collaborator (and multi-tab) updates merge into local feed
state — same spirit as [W6 board moves](../board/REALTIME_BOARD_MOVES.md).

## Behavior

- Subscribe while the details page is mounted (all three feeds). **No** board-style
  sync prefs (`realtime` / `static`).
- Merge channel payloads into local list state — **no** blanket `router.refresh()`
  for ordinary create / edit / archive of comments, activities, or work logs.
- Express mutations stay awaited (Vercel); realtime is fan-in for other clients
  and echo dedupe for the actor.
- Channel rows are flat table payloads (no embeds). Author / actor / user names
  are resolved from already-loaded client user lists (comment users, project
  members). Missing users fall back to “Unknown”.

## Channels

| Feed       | Table                | Channel prefix  | Filter                 | Events                 |
| ---------- | -------------------- | --------------- | ---------------------- | ---------------------- |
| Discussion | `comments`           | `wi-comments`   | `work_item_id=eq.<id>` | INSERT, UPDATE, DELETE |
| Activity   | `activities`         | `wi-activities` | `work_item_id=eq.<id>` | INSERT, UPDATE, DELETE |
| Work Log   | `work_item_worklogs` | `wi-worklogs`   | `work_item_id=eq.<id>` | INSERT, UPDATE, DELETE |

Publication migration:
`packages/db/prisma/migrations/add_discussion_feeds_realtime_publication/`
(idempotent `ALTER PUBLICATION supabase_realtime ADD TABLE …`).

## Merge rules

| Feed       | Helper                        | Notes                                                                |
| ---------- | ----------------------------- | -------------------------------------------------------------------- |
| Discussion | `applyRealtimeCommentChange`  | Upsert by id; UPDATE requires newer `updated_at`; DELETE removes     |
| Activity   | `applyRealtimeActivityChange` | Prepend INSERT; skip duplicate id; cap at `ACTIVITY_FEED_LIMIT`      |
| Work Log   | `applyRealtimeWorkLogChange`  | Prepend INSERT; UPDATE replace; archived/inactive status removes row |

Shared subscriber: `apps/web/lib/realtime/use-scoped-table-realtime.ts`
(modeled on `useWorkItemsRealtime`).

## Wiring

| Feed       | Owner                                                      |
| ---------- | ---------------------------------------------------------- |
| Discussion | `CommentsFeed` when `workItemId` is set                    |
| Activity   | `WorkItemDetails` state + channel → `WorkItemActivityTabs` |
| Work Log   | `WorkItemDetails` existing `workLogs` state + channel      |

## Non-goals

- Replacing W4 local merge on registry field edits.
- Board-move style pending drag stacks (feeds are append/update lists).
- Silent inbox notifications (still deferred).
- Per-event refetch-by-id for embeds.

## Related

- [REALTIME_BOARD_MOVES.md](../board/REALTIME_BOARD_MOVES.md) — W6 pattern reused
- [ACTIVITY.md](./ACTIVITY.md) — activity feed product notes
- [PERFORMANCE.md](../../guides/PERFORMANCE.md) — sequencing
- User guide: [Comments and activity](../../user-guide/work-items/comments-and-activity.md)
