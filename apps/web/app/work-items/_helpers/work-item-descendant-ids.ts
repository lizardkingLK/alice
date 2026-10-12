/** In-memory BFS of `parent_id` children under `rootId` (excludes root). */
export function collectLocalDescendantIds(
  rootId: string,
  items: readonly { readonly id: string; readonly parent_id: string | null }[]
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const item of items) {
    if (item.parent_id == null) {
      continue;
    }
    const siblings = childrenByParent.get(item.parent_id);
    if (siblings) {
      siblings.push(item.id);
    } else {
      childrenByParent.set(item.parent_id, [item.id]);
    }
  }

  const collected: string[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    frontier = frontier.flatMap((id) => {
      const children = childrenByParent.get(id) ?? [];
      collected.push(...children);
      return children;
    });
  }
  return collected;
}
