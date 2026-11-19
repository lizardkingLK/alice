/**
 * Immutable Set membership toggle for pending-id UI state.
 * Returns the same reference when membership is already correct.
 */
export function toggleIdInSet(
  previous: ReadonlySet<string>,
  id: string,
  shouldInclude: boolean
): Set<string> {
  const already = previous.has(id);
  if (shouldInclude === already) {
    return previous instanceof Set ? previous : new Set(previous);
  }
  const next = new Set(previous);
  if (shouldInclude) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}
