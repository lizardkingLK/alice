/**
 * Replace one row in a registry list by `id` (shallow merge).
 * Returns a new array; if the id is missing, returns a shallow copy of `items`.
 */
export function replaceEntityInList<T extends { readonly id: string }>(
  items: readonly T[],
  updated: T
): T[] {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index < 0) {
    return [...items];
  }
  const next = [...items];
  next[index] = { ...items[index]!, ...updated };
  return next;
}
