import type { ScopedRealtimeEvent } from '@/lib/realtime/use-scoped-table-realtime';

/**
 * Pick the row to merge from a postgres_changes payload.
 * DELETE uses `old` (fallback `new`); INSERT/UPDATE prefer `new`.
 */
export function rowFromRealtimePayload<T>(
  eventType: ScopedRealtimeEvent,
  nextRow: T | null,
  prevRow: T | null
): T | null {
  return eventType === 'DELETE' ? (prevRow ?? nextRow) : (nextRow ?? prevRow);
}
