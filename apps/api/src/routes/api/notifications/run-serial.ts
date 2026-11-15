/**
 * Run async work one item at a time, preserving order.
 * Uses recursion instead of `for` + `await` (typescript:S9382).
 */
export async function runSerial<T>(
  items: readonly T[],
  runItem: (item: T) => Promise<void>,
  offset = 0
): Promise<void> {
  if (offset >= items.length) {
    return;
  }
  await runItem(items[offset]!);
  return runSerial(items, runItem, offset + 1);
}
