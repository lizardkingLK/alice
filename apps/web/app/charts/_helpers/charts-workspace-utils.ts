import { removeLocalStorageItem } from '@/lib/local-storage';

/** Legacy mock / pre-cloud keys — remove on first Charts visit after Option A. */
const LEGACY_KEYS = [
  'alice.charts.board.layout.v1',
  'alice.charts.board.instances.v1',
] as const;

const STORE_PREFIX = 'alice.charts.workspaces.v1:';

/**
 * Drop obsolete charts localStorage (board cache + legacy single-board keys).
 * Safe to call repeatedly.
 */
export function clearLegacyChartsLocalStorage(userId?: string): void {
  for (const key of LEGACY_KEYS) {
    removeLocalStorageItem(key);
  }
  if (userId) {
    removeLocalStorageItem(`${STORE_PREFIX}${userId}`);
  }
}

export function createChartWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chart-${Date.now()}`;
}

export function suggestChartWorkspaceTitle(
  existingTitles: readonly string[]
): string {
  const base = 'Charts';
  if (!existingTitles.includes(base)) {
    return base;
  }
  let index = 2;
  while (existingTitles.includes(`${base} (${index})`)) {
    index += 1;
  }
  return `${base} (${index})`;
}
