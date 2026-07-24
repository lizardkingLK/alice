/**
 * Stable string ids for skeleton maps (avoids React array-index keys / S6479).
 */
export function skeletonKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}
