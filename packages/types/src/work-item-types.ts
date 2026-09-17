import { Constants } from './generated/supabase/database.types.js';
import { WorkItemType as WorkItemTypeEnum } from './generated/prisma/enums.js';

/** Canonical ordered work-item types (matches DB enum). */
export const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

export { WorkItemTypeEnum };
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

/** All work-item types available for project configuration. */
export const ALL_WORK_ITEM_TYPES: readonly WorkItemType[] = [
  WorkItemTypeEnum.Epic,
  WorkItemTypeEnum.Feature,
  WorkItemTypeEnum.Story,
  WorkItemTypeEnum.Task,
  WorkItemTypeEnum.Issue,
] as const;

export const CANONICAL_HIERARCHY_ORDER = ALL_WORK_ITEM_TYPES;

/**
 * Fixed standard ALICE system hierarchy:
 * Epic
 *  └── Story
 *       └── Task
 *            └── Issue
 *
 * Feature is not part of the default system hierarchy.
 * Custom hierarchy customization (such as Epic -> Feature -> Story -> Task -> Issue)
 * is strictly restricted to Jira import configuration.
 */
export const DEFAULT_SYSTEM_HIERARCHY: readonly WorkItemType[] = [
  WorkItemTypeEnum.Epic,
  WorkItemTypeEnum.Story,
  WorkItemTypeEnum.Task,
  WorkItemTypeEnum.Issue,
] as const;

/**
 * Default parent → allowed child type for subtask creation.
 * Follows the fixed system rules: Epic -> Story -> Task -> Issue.
 * Issue is a leaf and has no children.
 * Feature is not in the default hierarchy unless custom hierarchy is configured in Jira import.
 */
export const WORK_ITEM_CHILD_TYPE: Partial<Record<WorkItemType, WorkItemType>> =
  {
    [WorkItemTypeEnum.Epic]: WorkItemTypeEnum.Story,
    [WorkItemTypeEnum.Feature]: WorkItemTypeEnum.Story,
    [WorkItemTypeEnum.Story]: WorkItemTypeEnum.Task,
    [WorkItemTypeEnum.Task]: WorkItemTypeEnum.Issue,
  };

export type ResolvedProjectHierarchy = {
  parentToChild: Partial<Record<WorkItemType, WorkItemType>>;
  childToParent: Partial<Record<WorkItemType, WorkItemType>>;
};

function isTypePermitted(
  type: string,
  allowedTypes?: readonly WorkItemType[] | null
): boolean {
  if (!WORK_ITEM_TYPES.includes(type as WorkItemType)) {
    return false;
  }
  if (!allowedTypes || allowedTypes.length === 0) {
    return true;
  }
  return allowedTypes.includes(type as WorkItemType);
}

function resolveCustomHierarchy(
  customHierarchy: Record<string, string | null>,
  allowedTypes?: readonly WorkItemType[] | null
): ResolvedProjectHierarchy {
  const parentToChild: Partial<Record<WorkItemType, WorkItemType>> = {};
  const childToParent: Partial<Record<WorkItemType, WorkItemType>> = {};

  for (const [parent, child] of Object.entries(customHierarchy)) {
    if (
      child &&
      isTypePermitted(parent, allowedTypes) &&
      isTypePermitted(child, allowedTypes)
    ) {
      parentToChild[parent as WorkItemType] = child as WorkItemType;
      childToParent[child as WorkItemType] = parent as WorkItemType;
    }
  }

  return { parentToChild, childToParent };
}

function resolveDefaultHierarchy(
  allowedTypes?: readonly WorkItemType[] | null
): ResolvedProjectHierarchy {
  const parentToChild: Partial<Record<WorkItemType, WorkItemType>> = {};
  const childToParent: Partial<Record<WorkItemType, WorkItemType>> = {};

  const effectiveTypes =
    allowedTypes && allowedTypes.length > 0
      ? DEFAULT_SYSTEM_HIERARCHY.filter((type) => allowedTypes.includes(type))
      : DEFAULT_SYSTEM_HIERARCHY;

  for (let i = 0; i < effectiveTypes.length - 1; i++) {
    const parent = effectiveTypes[i]!;
    const child = effectiveTypes[i + 1]!;
    parentToChild[parent] = child;
    childToParent[child] = parent;
  }

  return { parentToChild, childToParent };
}

/**
 * Resolves the parent-child hierarchy for a project.
 * If customHierarchy is provided (strictly from Jira import), it takes precedence.
 * Otherwise, the hierarchy strictly follows the fixed system rules (Epic -> Story -> Task -> Issue).
 * Selecting work-item types during project creation/editing only controls which types are available,
 * and does not automatically customize or alter the fixed hierarchy.
 */
export function resolveProjectHierarchy(
  allowedTypes?: readonly WorkItemType[] | null,
  customHierarchy?: Record<string, string | null> | null
): ResolvedProjectHierarchy {
  if (customHierarchy && Object.keys(customHierarchy).length > 0) {
    return resolveCustomHierarchy(customHierarchy, allowedTypes);
  }
  return resolveDefaultHierarchy(allowedTypes);
}

export function getAllowedChildType(
  parentType: WorkItemType,
  allowedTypes?: readonly WorkItemType[] | null,
  customHierarchy?: Record<string, string | null> | null
): WorkItemType | null {
  if (!allowedTypes && !customHierarchy) {
    return WORK_ITEM_CHILD_TYPE[parentType] ?? null;
  }
  const { parentToChild } = resolveProjectHierarchy(
    allowedTypes,
    customHierarchy
  );
  return parentToChild[parentType] ?? null;
}

/**
 * Child → allowed parent type (inverse of {@link getAllowedChildType}).
 * Epic has no parent in standard hierarchy.
 */
export function getAllowedParentType(
  childType: WorkItemType,
  allowedTypes?: readonly WorkItemType[] | null,
  customHierarchy?: Record<string, string | null> | null
): WorkItemType | null {
  if (!allowedTypes && !customHierarchy) {
    if (childType === WorkItemTypeEnum.Story) {
      return WorkItemTypeEnum.Epic;
    }
    for (const [parentType, allowedChild] of Object.entries(
      WORK_ITEM_CHILD_TYPE
    ) as Array<[WorkItemType, WorkItemType]>) {
      if (allowedChild === childType) {
        return parentType;
      }
    }
    return null;
  }
  const { childToParent } = resolveProjectHierarchy(
    allowedTypes,
    customHierarchy
  );
  return childToParent[childType] ?? null;
}

/**
 * Static mapping of raw strings (including lowercase and aliases) to WorkItemType.
 */
export const WORK_ITEM_TYPE_MAPPINGS: Record<string, WorkItemType> = {
  epic: WorkItemTypeEnum.Epic,
  feature: WorkItemTypeEnum.Feature,
  story: WorkItemTypeEnum.Story,
  task: WorkItemTypeEnum.Task,
  'sub-task': WorkItemTypeEnum.Task,
  subtask: WorkItemTypeEnum.Task,
  bug: WorkItemTypeEnum.Issue,
  issue: WorkItemTypeEnum.Issue,
};

/**
 * Maps any string value to a valid WorkItemType enum value.
 */
export function mapToWorkItemType(
  input: string | null | undefined
): WorkItemType {
  if (!input) {
    return WorkItemTypeEnum.Task;
  }
  const normalized = input.trim().toLowerCase();
  return WORK_ITEM_TYPE_MAPPINGS[normalized] ?? WorkItemTypeEnum.Task;
}
