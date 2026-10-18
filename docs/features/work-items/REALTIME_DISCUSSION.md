# Realtime discussion feeds (planned)

| Field       | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Status      | **Planned**                                                                                   |
| Scope       | Work-item details tabs: Discussion (comments), Activity, Work Log — live sync without refresh |
| Sequencing  | After **W7** (done) and **M8** — see PERFORMANCE.md §9                                        |
| Performance | Linked from [PERFORMANCE.md](../../guides/PERFORMANCE.md); **not** a §9 write-latency ID      |

Work-item details already loads comments / activities / work logs in the initial
RSC payload. Registry and board **`router.refresh()`** paths do **not** reload
those feeds — so multi-tab or collaborator updates stay stale until a full
navigation. This plan adds Supabase realtime subscriptions so those tabs update
asynchronously, in the same spirit as [W6 board moves](../board/REALTIME_BOARD_MOVES.md).

## Goals

- Subscribe to relevant table events while the details page (or discussion
  section) is mounted.
- Merge channel payloads into local feed state — **no** blanket
  `router.refresh()` for ordinary create/edit/archive of comments, activities,
  or work logs.
- Prefer the same client realtime stack already used for board / W7
  (`work_items` and related publications) rather than inventing a second bus.
- Keep Express mutations awaited (Vercel); realtime is confirm / fan-in for
  other clients and optional echo dedupe for the actor.

## Non-goals

- Replacing W4 local merge on registry field edits.
- Making discussion realtime a board-move style “pending drag” stack (feeds are
  append/update lists, not spatial DnD).
- Silent inbox notifications (still deferred; see notifications README).

## Candidate channels

| Feed       | Likely tables / events                         | Notes                                     |
| ---------- | ---------------------------------------------- | ----------------------------------------- |
| Discussion | `comments` (and replies) scoped by work-item   | Filter by `work_item_id` on the open page |
| Activity   | `activities` scoped by work-item               | Complements [ACTIVITY.md](./ACTIVITY.md)  |
| Work Log   | work-log / allocation rows scoped by work-item | Align with existing worklog reader shapes |

Exact filter keys and publication membership land at implementation time —
verify `supabase_realtime` publication includes each table (same lesson as W6
`work_items` publication migration).

## Sequencing

| Step | Work                                                        | Doc / track                                                                               |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | **W7** — backlog DnD + calendar due-date DnD async/realtime | [PERFORMANCE.md §9 W7](../../guides/PERFORMANCE.md#w7--backlog--calendar-dnd-realtime) ✅ |
| 2    | **M8** — remaining read hot-path inventory                  | [PERFORMANCE.md §8.1](../../guides/PERFORMANCE.md)                                        |
| 3    | **This plan** — details discussion / activity / work-log RT | This document                                                                             |

## Related

- [REALTIME_BOARD_MOVES.md](../board/REALTIME_BOARD_MOVES.md) — W6 pattern to reuse
- [ACTIVITY.md](./ACTIVITY.md) — activity feed product notes (realtime was deferred here)
- [PERFORMANCE.md](../../guides/PERFORMANCE.md) — W7 done → M8 → this plan
- Work-item details implementation: `apps/web/app/work-items/[id]/`
