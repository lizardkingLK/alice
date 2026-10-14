import type { ChartHierarchyRingLevel } from '@repo/types';

export type ChartsHierarchyFocus = {
  readonly ring: ChartHierarchyRingLevel;
  readonly sliceKey: string;
  readonly parentKey?: string;
};

function isHierarchyRingLevel(value: number): value is ChartHierarchyRingLevel {
  return value === 0 || value === 1 || value === 2;
}

/** Encode nested-donut focus into the shared `focusedSliceKey` board field. */
export function encodeHierarchyFocus(focus: ChartsHierarchyFocus): string {
  if (focus.ring === 0) {
    return `h0:${focus.sliceKey}`;
  }
  return `h${focus.ring}:${focus.parentKey ?? ''}:${focus.sliceKey}`;
}

/** Parse a hierarchy focus key; returns null for flat-chart slice keys. */
export function parseHierarchyFocus(
  focusedSliceKey: string | null | undefined
): ChartsHierarchyFocus | null {
  if (!focusedSliceKey?.startsWith('h')) {
    return null;
  }
  const match = /^h([0-2]):(.+)$/.exec(focusedSliceKey);
  if (!match) {
    return null;
  }
  const ring = Number(match[1]);
  if (!isHierarchyRingLevel(ring)) {
    return null;
  }
  const rest = match[2] ?? '';
  if (ring === 0) {
    if (!rest) {
      return null;
    }
    return { ring: 0, sliceKey: rest };
  }
  const sep = rest.indexOf(':');
  if (sep < 0) {
    return null;
  }
  const parentKey = rest.slice(0, sep);
  const sliceKey = rest.slice(sep + 1);
  if (!sliceKey) {
    return null;
  }
  return {
    ring,
    sliceKey,
    ...(parentKey ? { parentKey } : {}),
  };
}
