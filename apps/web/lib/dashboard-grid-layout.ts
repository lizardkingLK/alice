import type { LayoutItem } from 'react-grid-layout';

function isLayoutItem(value: unknown): value is LayoutItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.i === 'string' &&
    typeof item.x === 'number' &&
    typeof item.y === 'number' &&
    typeof item.w === 'number' &&
    typeof item.h === 'number'
  );
}

/**
 * Merge a previously saved react-grid-layout array onto a default layout.
 * Preserves default `i` / min sizes; restores x/y/w/h when a stored item matches.
 * Unknown or invalid stored entries are ignored.
 */
export function mergeStoredDashboardLayout(
  defaults: readonly LayoutItem[],
  stored: unknown
): LayoutItem[] {
  if (!Array.isArray(stored) || stored.length === 0) {
    return defaults.map((item) => ({ ...item }));
  }

  const allowedIds = new Set(defaults.map((item) => item.i));
  const byId = new Map<string, LayoutItem>();
  for (const entry of stored) {
    if (!isLayoutItem(entry) || !allowedIds.has(entry.i)) {
      continue;
    }
    byId.set(entry.i, entry);
  }

  return defaults.map((fallback) => {
    const storedItem = byId.get(fallback.i);
    if (!storedItem) {
      return { ...fallback };
    }
    return {
      ...fallback,
      x: storedItem.x,
      y: storedItem.y,
      w: storedItem.w,
      h: storedItem.h,
    };
  });
}
