export type WorkItemLifecycleConfirmMode = 'archive' | 'purge' | 'restore';

type LifecycleConfirmCopy = {
  readonly title: string;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly isSoft: boolean;
  readonly actionVerb: string;
};

function childPhrase(descendantCount: number): string {
  const label = descendantCount === 1 ? 'child work item' : 'child work items';
  return `${descendantCount} ${label}`;
}

export function workItemLifecycleConfirmCopy(
  mode: WorkItemLifecycleConfirmMode,
  descendantCount: number,
  options?: {
    readonly hasParent?: boolean;
  }
): LifecycleConfirmCopy {
  const hasChildren = descendantCount > 0;
  const hasParent = Boolean(options?.hasParent);
  const children = childPhrase(descendantCount);

  if (mode === 'archive') {
    return {
      title: 'Archive work item',
      confirmLabel: 'Archive',
      isSoft: true,
      actionVerb: 'archive',
      detail: hasChildren
        ? `This will archive this item and ${children}. You can restore them later from the Archived tab.`
        : 'This work item will be archived. You can restore it later from the Archived tab.',
    };
  }

  if (mode === 'restore') {
    const unlinkDetail = hasParent
      ? 'Restoring will unlink this work item from its parent so it becomes a top-level item again.'
      : 'This work item will be restored to the active list.';
    const childrenDetail = hasChildren
      ? ` Its ${children} will be restored with it.`
      : '';
    return {
      title: 'Restore work item',
      confirmLabel: 'Restore',
      isSoft: true,
      actionVerb: 'restore',
      detail: `${unlinkDetail}${childrenDetail}`,
    };
  }

  // purge
  if (hasParent) {
    return {
      title: 'Permanently delete work item',
      confirmLabel: 'Delete permanently',
      isSoft: false,
      actionVerb: 'permanently delete',
      detail: hasChildren
        ? `This permanently deletes this work item and ${children}, and unlinks it from its parent. Comments, attachments, worklogs, linked PRs, and related notifications are removed. This cannot be undone.`
        : 'This permanently deletes this work item and unlinks it from its parent. Comments, attachments, worklogs, linked PRs, and related notifications are removed. This cannot be undone.',
    };
  }

  return {
    title: 'Permanently delete work item',
    confirmLabel: 'Delete permanently',
    isSoft: false,
    actionVerb: 'permanently delete',
    detail: hasChildren
      ? `This permanently deletes the work item and ${children} (parent through all descendants), including comments, attachments, worklogs, linked PRs, and related notifications. This cannot be undone.`
      : 'This permanently deletes the work item, including comments, attachments, worklogs, linked PRs, and related notifications. This cannot be undone.',
  };
}
