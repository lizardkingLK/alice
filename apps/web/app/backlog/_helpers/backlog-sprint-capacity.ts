/**
 * Sprint capacity math for backlog UI — mirrors API
 * `AllocationConfig` / `validateSprintAllocation` in workItems.service.
 */
export const BACKLOG_DEFAULT_CAPACITY = 40;
export const BACKLOG_DEFAULT_ALLOCATION = 100;

export type ProjectTeamMemberCapacity = {
  readonly projectId: string;
  readonly userId: string;
  readonly capacity: number | null;
  readonly allocation: number | null;
};

export type SprintCapacitySnapshot = {
  readonly usedPoints: number;
  readonly totalCapacity: number;
  readonly hasConfiguredCapacity: boolean;
  /** 0–100 when capacity is configured; otherwise 0. */
  readonly percentUsed: number;
};

export function effectiveMemberCapacity(
  capacity: number | null,
  allocation: number | null
): number {
  const cap = capacity ?? BACKLOG_DEFAULT_CAPACITY;
  const alloc = allocation ?? BACKLOG_DEFAULT_ALLOCATION;
  return cap * (alloc / 100);
}

export function computeSprintCapacity(options: {
  readonly projectId: string | null | undefined;
  readonly storyPoints: readonly (number | null | undefined)[];
  readonly teamMembers: readonly ProjectTeamMemberCapacity[];
}): SprintCapacitySnapshot {
  const usedPoints = options.storyPoints.reduce<number>(
    (sum, points) => sum + (points || 0),
    0
  );

  const projectId = options.projectId;
  if (!projectId) {
    return {
      usedPoints,
      totalCapacity: 0,
      hasConfiguredCapacity: false,
      percentUsed: 0,
    };
  }

  const members = options.teamMembers.filter(
    (member) => member.projectId === projectId
  );

  let totalCapacity = 0;
  let hasConfiguredCapacity = false;

  for (const member of members) {
    totalCapacity += effectiveMemberCapacity(
      member.capacity,
      member.allocation
    );
    if (member.capacity !== null || member.allocation !== null) {
      hasConfiguredCapacity = true;
    }
  }

  const percentUsed =
    hasConfiguredCapacity && totalCapacity > 0
      ? Math.min(100, Math.round((usedPoints / totalCapacity) * 100))
      : 0;

  return {
    usedPoints,
    totalCapacity,
    hasConfiguredCapacity,
    percentUsed,
  };
}

export function formatCapacityPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Compact header label: `12 / 40` or `12 pts` when capacity is unconfigured. */
export function formatCapacityHeaderLabel(
  snapshot: SprintCapacitySnapshot
): string {
  if (snapshot.hasConfiguredCapacity) {
    return `${formatCapacityPoints(snapshot.usedPoints)} / ${formatCapacityPoints(snapshot.totalCapacity)}`;
  }
  return `${formatCapacityPoints(snapshot.usedPoints)} pts`;
}

/**
 * Rounded percent of capacity used (not capped at 100, so over-capacity can
 * show values like `125%`). Returns `—` when capacity is unconfigured.
 */
export function formatCapacityPercentLabel(
  snapshot: SprintCapacitySnapshot
): string {
  if (!snapshot.hasConfiguredCapacity || snapshot.totalCapacity <= 0) {
    return '—';
  }
  return `${Math.round((snapshot.usedPoints / snapshot.totalCapacity) * 100)}%`;
}

export function isCapacityOver(snapshot: SprintCapacitySnapshot): boolean {
  return (
    snapshot.hasConfiguredCapacity &&
    snapshot.usedPoints > snapshot.totalCapacity
  );
}

/** Near-full warning (not over) for amber styling. */
export function isCapacityNearFull(snapshot: SprintCapacitySnapshot): boolean {
  return (
    snapshot.hasConfiguredCapacity &&
    !isCapacityOver(snapshot) &&
    snapshot.percentUsed >= 90
  );
}
