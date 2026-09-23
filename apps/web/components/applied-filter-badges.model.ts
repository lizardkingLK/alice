import type { AppliedFilterBadgeItem } from '@/components/applied-filter-badges';
import {
  appliedFilterLabelChipId,
  parseAppliedFilterLabelChipId,
} from '@/components/applied-filter-badges';

export type AppliedFilterNamedValue = {
  readonly id: string;
  readonly name: string;
};

/**
 * Build applied-filter badge items from named filter values.
 * Pass only values that should appear (already non-default / active).
 */
export function buildAppliedFilterBadgeItems(options: {
  readonly search?: string | null;
  readonly project?: AppliedFilterNamedValue | null;
  readonly sprint?: AppliedFilterNamedValue | null;
  readonly type?: AppliedFilterNamedValue | null;
  readonly assignee?: AppliedFilterNamedValue | null;
  readonly priority?: AppliedFilterNamedValue | null;
  readonly labels?: readonly string[];
}): AppliedFilterBadgeItem[] {
  const items: AppliedFilterBadgeItem[] = [];
  const trimmedSearch = options.search?.trim();
  if (trimmedSearch) {
    items.push({
      id: 'search',
      fieldId: 'search',
      label: trimmedSearch,
    });
  }
  if (options.project) {
    items.push({
      id: 'project',
      fieldId: 'project',
      label: options.project.name,
    });
  }
  if (options.sprint) {
    items.push({
      id: 'sprint',
      fieldId: 'sprint',
      label: options.sprint.name,
    });
  }
  if (options.type) {
    items.push({
      id: 'type',
      fieldId: 'type',
      label: options.type.name,
    });
  }
  if (options.assignee) {
    items.push({
      id: 'assignee',
      fieldId: 'assignee',
      label: options.assignee.name,
    });
  }
  if (options.priority) {
    items.push({
      id: 'priority',
      fieldId: 'priority',
      label: options.priority.name,
    });
  }
  for (const label of options.labels ?? []) {
    items.push({
      id: appliedFilterLabelChipId(label),
      fieldId: 'labels',
      label,
    });
  }
  return items;
}

/**
 * Project chip for toolbars that may show either a concrete project or
 * “All projects” when defaults are overridden.
 */
export function resolveProjectFilterBadge(options: {
  readonly showBadge: boolean;
  readonly projectId: string | null | undefined;
  readonly allValue: string;
  // eslint-disable-next-line no-unused-vars -- name lookup
  readonly resolveName: (projectId: string) => string;
}): AppliedFilterNamedValue | null {
  if (!options.showBadge) {
    return null;
  }
  if (options.projectId && options.projectId !== options.allValue) {
    return {
      id: options.projectId,
      name: options.resolveName(options.projectId),
    };
  }
  return { id: options.allValue, name: 'All projects' };
}

export type AppliedFilterRemovalPlan = {
  readonly labelsToDrop: ReadonlySet<string>;
  readonly clearSearch: boolean;
  readonly clearType: boolean;
  readonly clearAssignee: boolean;
  readonly clearProject: boolean;
  readonly clearSprint: boolean;
  readonly clearPriority: boolean;
};

/**
 * Classify debounced chip dismiss ids into one removal plan for a single
 * URL / state update.
 */
export function planAppliedFilterRemovals(
  chipIds: readonly string[],
  options: {
    readonly canClearAssignee?: boolean;
    readonly canClearProject?: boolean;
  } = {}
): AppliedFilterRemovalPlan {
  const canClearAssignee = options.canClearAssignee !== false;
  const canClearProject = options.canClearProject !== false;
  const labelsToDrop = new Set<string>();
  let clearSearch = false;
  let clearType = false;
  let clearAssignee = false;
  let clearProject = false;
  let clearSprint = false;
  let clearPriority = false;

  for (const chipId of chipIds) {
    const labelFromChip = parseAppliedFilterLabelChipId(chipId);
    if (labelFromChip != null) {
      labelsToDrop.add(labelFromChip);
      continue;
    }

    switch (chipId) {
      case 'search':
        clearSearch = true;
        break;
      case 'type':
        clearType = true;
        break;
      case 'assignee':
        if (canClearAssignee) {
          clearAssignee = true;
        }
        break;
      case 'project':
        if (canClearProject) {
          clearProject = true;
        }
        break;
      case 'sprint':
        clearSprint = true;
        break;
      case 'priority':
        clearPriority = true;
        break;
      default:
        break;
    }
  }

  return {
    labelsToDrop,
    clearSearch,
    clearType,
    clearAssignee,
    clearProject,
    clearSprint,
    clearPriority,
  };
}
