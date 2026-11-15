/**
 * Sprint contribution table helpers (Charts widget).
 * Ideal spend matches burndown / worklog-pending reminders (1 SP ≈ 1 hour).
 */

import { computeBurndownIdealSpent } from './sprint-burndown.js';

export const SPRINT_CONTRIBUTION_GROUPS = [
  'active',
  'unassigned',
  'done',
] as const;

export type SprintContributionGroupId =
  (typeof SPRINT_CONTRIBUTION_GROUPS)[number];

/** Logged vs estimate completion band for Progress cell styling. */
export type SprintContributionLoggedBand = 'critical' | 'low' | 'mid' | 'high';

export type SprintContributionItemInput = {
  readonly id: string;
  readonly assigneeId: string | null;
  readonly storyPoints: number | null;
  /** True when the item is Done (status Done or equivalent). */
  readonly isDone: boolean;
};

export type SprintContributionLogInput = {
  readonly workItemId: string;
  readonly loggedAt: string;
  readonly loggedHours: number;
};

export type SprintContributionRow = {
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly group: SprintContributionGroupId;
  readonly estimatedPoints: number;
  readonly loggedHours: number;
  readonly idealSpent: number;
  readonly pendingHours: number;
  readonly behind: boolean;
  readonly itemCount: number;
};

export type SprintContributionGroup = {
  readonly id: SprintContributionGroupId;
  readonly rows: readonly SprintContributionRow[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDayLabel(iso: string): string {
  return iso.slice(0, 10);
}

/** Clamp as-of into [start, end] for ideal-line math. */
export function clampContributionAsOf(
  asOf: string,
  startDate: string,
  endDate: string
): string {
  if (asOf < startDate) {
    return startDate;
  }
  if (asOf > endDate) {
    return endDate;
  }
  return asOf;
}

/**
 * Completion % of estimate → color band for the Logged Progress cell.
 * ≤25% critical, ≤50% low, ≤75% mid, else high.
 */
export function sprintContributionLoggedBand(
  loggedHours: number,
  estimatedPoints: number
): SprintContributionLoggedBand {
  if (estimatedPoints <= 0) {
    return loggedHours > 0 ? 'high' : 'critical';
  }
  const percent = (loggedHours / estimatedPoints) * 100;
  if (percent <= 25) {
    return 'critical';
  }
  if (percent <= 50) {
    return 'low';
  }
  if (percent <= 75) {
    return 'mid';
  }
  return 'high';
}

export function sprintContributionPercent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((part / total) * 100));
}

type Bucket = {
  assigneeId: string | null;
  itemIds: string[];
  estimatedPoints: number;
  hasOpen: boolean;
};

type GroupBuckets = {
  active: SprintContributionRow[];
  unassigned: SprintContributionRow[];
  done: SprintContributionRow[];
};

function matchesAssigneeFilter(
  assigneeId: string | null,
  filter: string | null | undefined
): boolean {
  if (filter === undefined) {
    return true;
  }
  if (filter === null) {
    return assigneeId === null;
  }
  return assigneeId === filter;
}

function resolveContributionGroup(
  assigneeId: string | null,
  hasOpen: boolean
): SprintContributionGroupId {
  if (assigneeId === null) {
    return 'unassigned';
  }
  return hasOpen ? 'active' : 'done';
}

function resolveAssigneeName(
  assigneeId: string | null,
  nameById: Readonly<Record<string, string>>
): string | null {
  if (assigneeId === null) {
    return null;
  }
  return nameById[assigneeId] ?? null;
}

function buildContributionMetrics(params: {
  readonly assigneeId: string | null;
  readonly estimatedPoints: number;
  readonly loggedHours: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly asOf: string;
}): {
  estimatedPoints: number;
  loggedHours: number;
  idealSpent: number;
  pendingHours: number;
  behind: boolean;
} {
  const estimatedPoints = round2(params.estimatedPoints);
  const loggedHours = round2(params.loggedHours);
  const idealSpent = computeBurndownIdealSpent(
    estimatedPoints,
    params.startDate,
    params.endDate,
    params.asOf
  );
  const pendingHours = round2(Math.max(0, idealSpent - loggedHours));
  return {
    estimatedPoints,
    loggedHours,
    idealSpent,
    pendingHours,
    behind: pendingHours > 0 && params.assigneeId !== null,
  };
}

function pushRowToGroupBuckets(
  buckets: GroupBuckets,
  row: SprintContributionRow
): void {
  if (row.group === 'active') {
    buckets.active.push(row);
    return;
  }
  if (row.group === 'unassigned') {
    buckets.unassigned.push(row);
    return;
  }
  buckets.done.push(row);
}

function sortAndPackGroups(buckets: GroupBuckets): SprintContributionGroup[] {
  const byName = (left: SprintContributionRow, right: SprintContributionRow) =>
    (left.assigneeName ?? '').localeCompare(right.assigneeName ?? '');
  buckets.active.sort(byName);
  buckets.done.sort(byName);
  return [
    { id: 'active', rows: buckets.active },
    { id: 'unassigned', rows: buckets.unassigned },
    { id: 'done', rows: buckets.done },
  ];
}

function accumulateItemBuckets(
  items: readonly SprintContributionItemInput[],
  assigneeFilter: string | null | undefined
): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    if (!matchesAssigneeFilter(item.assigneeId, assigneeFilter)) {
      continue;
    }
    const key = item.assigneeId ?? '';
    const points = item.storyPoints ?? 0;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        assigneeId: item.assigneeId,
        itemIds: [item.id],
        estimatedPoints: points,
        hasOpen: !item.isDone,
      });
      continue;
    }
    existing.itemIds.push(item.id);
    existing.estimatedPoints += points;
    existing.hasOpen = existing.hasOpen || !item.isDone;
  }
  return buckets;
}

function sumLoggedHoursByItem(
  logs: readonly SprintContributionLogInput[],
  itemIdSet: ReadonlySet<string>,
  asOf: string
): Map<string, number> {
  const loggedByItem = new Map<string, number>();
  for (const log of logs) {
    if (!itemIdSet.has(log.workItemId) || toDayLabel(log.loggedAt) > asOf) {
      continue;
    }
    loggedByItem.set(
      log.workItemId,
      (loggedByItem.get(log.workItemId) ?? 0) + log.loggedHours
    );
  }
  return loggedByItem;
}

function sumBucketLoggedHours(
  itemIds: readonly string[],
  loggedByItem: ReadonlyMap<string, number>
): number {
  let loggedHours = 0;
  for (const id of itemIds) {
    loggedHours += loggedByItem.get(id) ?? 0;
  }
  return loggedHours;
}

/**
 * Aggregate sprint items + worklogs into Active / Unassigned / Done groups.
 * Names are filled by the caller (API) via `assigneeNames`.
 */
export function buildSprintContributionGroups(params: {
  readonly items: readonly SprintContributionItemInput[];
  readonly logs: readonly SprintContributionLogInput[];
  readonly startDate: string;
  readonly endDate: string;
  readonly asOf: string;
  readonly assigneeNames?: Readonly<Record<string, string>>;
  /** When set, only that assignee row (Unassigned omitted). */
  readonly assigneeId?: string | null;
}): SprintContributionGroup[] {
  const asOf = clampContributionAsOf(
    params.asOf,
    params.startDate,
    params.endDate
  );
  const nameById = params.assigneeNames ?? {};
  const itemBuckets = accumulateItemBuckets(params.items, params.assigneeId);

  const itemIdSet = new Set<string>();
  for (const bucket of itemBuckets.values()) {
    for (const id of bucket.itemIds) {
      itemIdSet.add(id);
    }
  }
  const loggedByItem = sumLoggedHoursByItem(params.logs, itemIdSet, asOf);

  const groups: GroupBuckets = { active: [], unassigned: [], done: [] };
  for (const bucket of itemBuckets.values()) {
    const metrics = buildContributionMetrics({
      assigneeId: bucket.assigneeId,
      estimatedPoints: bucket.estimatedPoints,
      loggedHours: sumBucketLoggedHours(bucket.itemIds, loggedByItem),
      startDate: params.startDate,
      endDate: params.endDate,
      asOf,
    });
    const group = resolveContributionGroup(bucket.assigneeId, bucket.hasOpen);
    pushRowToGroupBuckets(groups, {
      assigneeId: bucket.assigneeId,
      assigneeName: resolveAssigneeName(bucket.assigneeId, nameById),
      group,
      itemCount: bucket.itemIds.length,
      ...metrics,
    });
  }

  return sortAndPackGroups(groups);
}

export type SprintContributionRollupRowInput = {
  readonly assigneeId: string | null;
  readonly group: SprintContributionGroupId;
  readonly estimatedPoints: number;
  readonly loggedHours: number;
  readonly itemCount: number;
  readonly asOf: string;
};

/**
 * Map precomputed contribution rollup rows into Active / Unassigned / Done
 * groups. Ideal / pending / behind are derived at read time.
 */
export function groupsFromSprintContributionRollupRows(params: {
  readonly rows: readonly SprintContributionRollupRowInput[];
  readonly startDate: string;
  readonly endDate: string;
  readonly asOf: string;
  readonly assigneeNames?: Readonly<Record<string, string>>;
  readonly assigneeId?: string | null;
}): SprintContributionGroup[] {
  const asOf = clampContributionAsOf(
    params.asOf,
    params.startDate,
    params.endDate
  );
  const nameById = params.assigneeNames ?? {};
  const groups: GroupBuckets = { active: [], unassigned: [], done: [] };

  for (const raw of params.rows) {
    if (!matchesAssigneeFilter(raw.assigneeId, params.assigneeId)) {
      continue;
    }
    const metrics = buildContributionMetrics({
      assigneeId: raw.assigneeId,
      estimatedPoints: raw.estimatedPoints,
      loggedHours: raw.loggedHours,
      startDate: params.startDate,
      endDate: params.endDate,
      asOf,
    });
    pushRowToGroupBuckets(groups, {
      assigneeId: raw.assigneeId,
      assigneeName: resolveAssigneeName(raw.assigneeId, nameById),
      group: raw.group,
      itemCount: raw.itemCount,
      ...metrics,
    });
  }

  return sortAndPackGroups(groups);
}
