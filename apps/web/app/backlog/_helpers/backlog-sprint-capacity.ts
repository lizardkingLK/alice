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
