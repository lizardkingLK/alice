import {
  DynamicFieldConstantsEnum,
  SprintStatusEnum,
  TemplateFieldKeyEnum,
  type PreviousSprintCompletion,
  type SprintEstimationHistoryItem,
  type SprintEstimationInput,
  type SprintEstimationWorkItem,
} from '@repo/types';
import { prisma } from '../../../lib/prisma';

export const SPRINT_ESTIMATION_TARGET_LIMIT = 200;
export const SPRINT_ESTIMATION_HISTORY_LIMIT = 100;
export const SPRINT_ESTIMATION_PREVIOUS_SPRINT_LIMIT = 5;

/**
 * Prior sprint totals are reconstructed from work items currently attached to
 * each sprint. They are not immutable commitment snapshots.
 */
export const PREVIOUS_SPRINT_COMPLETION_BASIS =
  'current_work_item_state_approximation' as const;

export type SprintEstimationRepositoryData = {
  sprintId: string;
  projectId: string;
  estimationInputs: SprintEstimationInput[];
  previousSprintCompletionBasis: typeof PREVIOUS_SPRINT_COMPLETION_BASIS;
};

type EstimationAssignee = {
  team_memberships: Array<{ seniority: string | null }>;
} | null;

type EstimationWorkItemRow = {
  id: string;
  project_id: string;
  type: SprintEstimationWorkItem['type'];
  priority: SprintEstimationWorkItem['priority'];
  description: unknown;
  story_points: number | null;
  assignee_id: string | null;
  assignee: EstimationAssignee;
};

type EstimationHistoryRow = EstimationWorkItemRow & {
  worklogs: Array<{ logged_hours: number }>;
};

type SprintCompletionGroup = {
  sprint_id: string | null;
  status_category: string;
  _sum: { story_points: number | null };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function severityFromMarkerText(text: string): string | null {
  const markerIndex = text.indexOf(DynamicFieldConstantsEnum.MARKER);
  if (markerIndex < 0) {
    return null;
  }

  const dynamicFieldText = text.slice(
    markerIndex + DynamicFieldConstantsEnum.MARKER.length
  );
  for (const line of dynamicFieldText.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (key === TemplateFieldKeyEnum.SEVERITY) {
      return nonEmptyString(line.slice(separatorIndex + 1));
    }
  }
  return null;
}

function severityFromContent(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const severity = severityFromContent(child);
      if (severity) {
        return severity;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }

  const text = nonEmptyString(value.text);
  if (text) {
    const severity = severityFromMarkerText(text);
    if (severity) {
      return severity;
    }
  }
  return severityFromContent(value.content);
}

/** Extract the configured severity without exposing the rest of the description. */
export function extractSprintEstimationSeverity(
  description: unknown
): string | null {
  if (!isRecord(description)) {
    return null;
  }

  const attrs = isRecord(description.attrs) ? description.attrs : null;
  const dynamicFields =
    attrs && isRecord(attrs.dynamicFields) ? attrs.dynamicFields : null;
  const severity = dynamicFields
    ? nonEmptyString(dynamicFields[TemplateFieldKeyEnum.SEVERITY])
    : null;
  return severity ?? severityFromContent(description.content);
}

function assigneeSeniority(assignee: EstimationAssignee): string | null {
  for (const membership of assignee?.team_memberships ?? []) {
    const seniority = nonEmptyString(membership.seniority);
    if (seniority) {
      return seniority;
    }
  }
  return null;
}

function assigneeSelect(projectId: string) {
  return {
    select: {
      team_memberships: {
        where: {
          status: 'active',
          seniority: { not: null },
          team: { project_id: projectId, status: 'active' },
        },
        select: { seniority: true },
        orderBy: { team_id: 'asc' },
        take: 5,
      },
    },
  } as const;
}

function workItemSelect(projectId: string) {
  return {
    id: true,
    project_id: true,
    type: true,
    priority: true,
    description: true,
    story_points: true,
    assignee_id: true,
    assignee: assigneeSelect(projectId),
  } as const;
}

function historyWorkItemSelect(projectId: string) {
  return {
    ...workItemSelect(projectId),
    worklogs: {
      where: { status: 'active', logged_hours: { gt: 0 } },
      select: { logged_hours: true },
      orderBy: { id: 'asc' },
    },
  } as const;
}

function mapWorkItem(row: EstimationWorkItemRow): SprintEstimationWorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    priority: row.priority,
    severity: extractSprintEstimationSeverity(row.description),
    storyPoints: row.story_points,
    assigneeId: row.assignee_id,
    assigneeSeniority: assigneeSeniority(row.assignee),
  };
}

function mapHistoryItem(
  row: EstimationHistoryRow
): SprintEstimationHistoryItem | null {
  const loggedHours = row.worklogs.reduce((total, worklog) => {
    return Number.isFinite(worklog.logged_hours) && worklog.logged_hours > 0
      ? total + worklog.logged_hours
      : total;
  }, 0);
  if (!Number.isFinite(loggedHours) || loggedHours <= 0) {
    return null;
  }

  const item = mapWorkItem(row);
  return {
    projectId: item.projectId,
    type: item.type,
    priority: item.priority,
    severity: item.severity,
    storyPoints: item.storyPoints,
    assigneeId: item.assigneeId,
    assigneeSeniority: item.assigneeSeniority,
    loggedHours,
    completed: true,
  };
}

function mapPreviousSprintCompletions(
  sprintIds: readonly string[],
  groups: readonly SprintCompletionGroup[]
): PreviousSprintCompletion[] {
  return sprintIds.flatMap((sprintId) => {
    const sprintGroups = groups.filter((group) => group.sprint_id === sprintId);
    const committedStoryPoints = sprintGroups.reduce(
      (total, group) => total + (group._sum.story_points ?? 0),
      0
    );
    if (committedStoryPoints <= 0) {
      return [];
    }
    const completedStoryPoints = sprintGroups
      .filter((group) => group.status_category === 'done')
      .reduce((total, group) => total + (group._sum.story_points ?? 0), 0);

    return [{ committedStoryPoints, completedStoryPoints }];
  });
}

export class SprintEstimationRepository {
  async loadForSprint(
    sprintId: string
  ): Promise<SprintEstimationRepositoryData | null> {
    try {
      const sprint = await prisma.sprints.findUnique({
        where: { id: sprintId },
        select: { id: true, project_id: true, start_date: true },
      });
      if (!sprint) {
        return null;
      }

      const [targetRows, historyRows, previousSprints] = await Promise.all([
        prisma.work_items.findMany({
          where: {
            sprint_id: sprint.id,
            project_id: sprint.project_id,
            record_status: 'active',
          },
          select: workItemSelect(sprint.project_id),
          orderBy: { id: 'asc' },
          take: SPRINT_ESTIMATION_TARGET_LIMIT,
        }),
        prisma.work_items.findMany({
          where: {
            project_id: sprint.project_id,
            record_status: 'active',
            status_category: 'done',
            done_at: { lt: sprint.start_date },
            worklogs: {
              some: { status: 'active', logged_hours: { gt: 0 } },
            },
          },
          select: historyWorkItemSelect(sprint.project_id),
          orderBy: [{ done_at: 'desc' }, { id: 'asc' }],
          take: SPRINT_ESTIMATION_HISTORY_LIMIT,
        }),
        prisma.sprints.findMany({
          where: {
            project_id: sprint.project_id,
            id: { not: sprint.id },
            status: {
              in: [SprintStatusEnum.Closed, SprintStatusEnum.Archived],
            },
            end_date: { lt: sprint.start_date },
          },
          select: { id: true },
          orderBy: [{ end_date: 'desc' }, { id: 'asc' }],
          take: SPRINT_ESTIMATION_PREVIOUS_SPRINT_LIMIT,
        }),
      ]);

      const previousSprintIds = previousSprints.map((item) => item.id);
      let completionGroups: SprintCompletionGroup[] = [];
      if (previousSprintIds.length > 0) {
        const groupedRows = await prisma.work_items.groupBy({
          by: ['sprint_id', 'status_category'],
          where: {
            project_id: sprint.project_id,
            sprint_id: { in: previousSprintIds },
            record_status: 'active',
            story_points: { gt: 0 },
          },
          _sum: { story_points: true },
          orderBy: [{ sprint_id: 'asc' }, { status_category: 'asc' }],
        });
        completionGroups = groupedRows as SprintCompletionGroup[];
      }

      const history = historyRows
        .filter((row) => row.project_id === sprint.project_id)
        .map(mapHistoryItem)
        .filter((item): item is SprintEstimationHistoryItem => item !== null);
      const previousSprintCompletions = mapPreviousSprintCompletions(
        previousSprintIds,
        completionGroups
      );
      const estimationInputs = targetRows
        .filter((row) => row.project_id === sprint.project_id)
        .map((row) => ({
          workItem: mapWorkItem(row),
          history,
          previousSprintCompletions,
        }));

      return {
        sprintId: sprint.id,
        projectId: sprint.project_id,
        estimationInputs,
        previousSprintCompletionBasis: PREVIOUS_SPRINT_COMPLETION_BASIS,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        'error. failed to load sprint estimation history:',
        message
      );
      throw new Error('Failed to load sprint estimation history');
    }
  }
}
