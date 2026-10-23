import { z } from 'zod';
import { WORK_ITEM_PRIORITIES } from '../../work-item-priorities.js';
import { WORK_ITEM_TYPES, type WorkItemType } from '../../work-item-types.js';

export const SPRINT_ESTIMATION_CONFIDENCE_LEVELS = [
  'low',
  'medium',
  'high',
] as const;
export const sprintEstimationConfidenceSchema = z.enum(
  SPRINT_ESTIMATION_CONFIDENCE_LEVELS
);
export type SprintEstimationConfidence = z.infer<
  typeof sprintEstimationConfidenceSchema
>;

export const SPRINT_ESTIMATION_SOURCES = [
  'assignee_history',
  'similar_history',
  'experience_history',
  'project_history',
  'rough_fallback',
] as const;
export const sprintEstimationSourceSchema = z.enum(SPRINT_ESTIMATION_SOURCES);
export type SprintEstimationSource = z.infer<
  typeof sprintEstimationSourceSchema
>;

const optionalCharacteristicSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

export const sprintEstimationWorkItemSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    type: z.enum(WORK_ITEM_TYPES),
    priority: z.enum(WORK_ITEM_PRIORITIES),
    severity: optionalCharacteristicSchema,
    storyPoints: z.number().int().nonnegative().nullable(),
    assigneeId: z.uuid().nullable(),
    assigneeSeniority: optionalCharacteristicSchema,
  })
  .strict();
export type SprintEstimationWorkItem = z.infer<
  typeof sprintEstimationWorkItemSchema
>;

export const sprintEstimationHistoryItemSchema = z
  .object({
    projectId: z.uuid(),
    type: z.enum(WORK_ITEM_TYPES),
    priority: z.enum(WORK_ITEM_PRIORITIES),
    severity: optionalCharacteristicSchema,
    storyPoints: z.number().int().nonnegative().nullable(),
    assigneeId: z.uuid().nullable(),
    assigneeSeniority: optionalCharacteristicSchema,
    loggedHours: z.number().finite().nonnegative(),
    completed: z.literal(true),
  })
  .strict();
export type SprintEstimationHistoryItem = z.infer<
  typeof sprintEstimationHistoryItemSchema
>;

export const previousSprintCompletionSchema = z
  .object({
    committedStoryPoints: z.number().int().positive(),
    completedStoryPoints: z.number().int().nonnegative(),
  })
  .strict();
export type PreviousSprintCompletion = z.infer<
  typeof previousSprintCompletionSchema
>;

export const sprintEstimationInputSchema = z
  .object({
    workItem: sprintEstimationWorkItemSchema,
    history: z.array(sprintEstimationHistoryItemSchema),
    previousSprintCompletions: z.array(previousSprintCompletionSchema),
  })
  .strict();
export type SprintEstimationInput = z.infer<typeof sprintEstimationInputSchema>;

const boundedHoursSchema = z.number().min(0.5).max(1_000).multipleOf(0.5);

export const sprintWorkItemEstimateSchema = z
  .object({
    workItemId: z.uuid(),
    suggestedHours: boundedHoursSchema,
    minimumHours: boundedHoursSchema,
    maximumHours: boundedHoursSchema,
    confidence: sprintEstimationConfidenceSchema,
    source: sprintEstimationSourceSchema,
    evidenceCount: z.number().int().nonnegative(),
    roughEstimate: z.boolean(),
    rationale: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((estimate, context) => {
    if (estimate.minimumHours > estimate.suggestedHours) {
      context.addIssue({
        code: 'custom',
        message: 'Minimum hours cannot exceed suggested hours',
        path: ['minimumHours'],
      });
    }
    if (estimate.maximumHours < estimate.suggestedHours) {
      context.addIssue({
        code: 'custom',
        message: 'Maximum hours cannot be less than suggested hours',
        path: ['maximumHours'],
      });
    }
  });
export type SprintWorkItemEstimate = z.infer<
  typeof sprintWorkItemEstimateSchema
>;

export const sprintEstimationResponseSchema = z
  .object({
    sprintId: z.uuid(),
    estimates: z.array(sprintWorkItemEstimateSchema),
  })
  .strict();
export type SprintEstimationResponse = z.infer<
  typeof sprintEstimationResponseSchema
>;

/** Three usable completed items are required before history influences an estimate. */
export const SPRINT_ESTIMATION_MIN_HISTORY_SAMPLES = 3;
/** Five narrow, comparable samples qualify an estimate for high confidence. */
export const SPRINT_ESTIMATION_HIGH_CONFIDENCE_SAMPLES = 5;
export const SPRINT_ESTIMATION_MIN_HOURS = 0.5;
export const SPRINT_ESTIMATION_MAX_HOURS = 1_000;

/** Rough hours used only when neither usable history nor positive points exist. */
const ROUGH_HOURS_BY_TYPE: Readonly<Record<WorkItemType, number>> = {
  Epic: 40,
  Feature: 24,
  Story: 8,
  Task: 4,
  Issue: 4,
};

type EvidencePool = {
  items: SprintEstimationHistoryItem[];
  source: Exclude<SprintEstimationSource, 'rough_fallback'>;
  description: string;
  highConfidenceEligible: boolean;
  mediumConfidenceEligible: boolean;
};

function normalized(value: string | null | undefined): string | null {
  const result = value?.trim().toLowerCase();
  return result ? result : null;
}

function roundToHalfHour(value: number): number {
  return Math.round(value * 2) / 2;
}

function boundedHours(value: number): number {
  return Math.min(
    SPRINT_ESTIMATION_MAX_HOURS,
    Math.max(SPRINT_ESTIMATION_MIN_HOURS, roundToHalfHour(value))
  );
}

/** Median of the finite values. The source array is never mutated. */
export function median(values: readonly number[]): number | null {
  const sorted = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function percentile(values: readonly number[], percentileRank: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentileRank;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex]!;
  const upper = sorted[upperIndex]!;
  return lower + (upper - lower) * (index - lowerIndex);
}

function matchesComparableCharacteristics(
  item: SprintEstimationHistoryItem,
  target: SprintEstimationWorkItem
): boolean {
  if (item.priority !== target.priority) {
    return false;
  }

  const targetSeverity = normalized(target.severity);
  return (
    targetSeverity === null || normalized(item.severity) === targetSeverity
  );
}

function selectEvidencePool(input: SprintEstimationInput): EvidencePool | null {
  const { workItem } = input;
  const useHoursPerPoint = (workItem.storyPoints ?? 0) > 0;
  const usable = input.history.filter((item) => {
    return (
      item.completed &&
      item.projectId === workItem.projectId &&
      Number.isFinite(item.loggedHours) &&
      item.loggedHours > 0 &&
      (!useHoursPerPoint || (item.storyPoints ?? 0) > 0)
    );
  });
  const sameType = usable.filter((item) => item.type === workItem.type);
  const comparable = sameType.filter((item) => {
    return matchesComparableCharacteristics(item, workItem);
  });

  const pools: EvidencePool[] = [];
  if (workItem.assigneeId) {
    pools.push(
      {
        items: comparable.filter(
          (item) => item.assigneeId === workItem.assigneeId
        ),
        source: 'assignee_history',
        description: 'comparable items assigned to this assignee',
        highConfidenceEligible: true,
        mediumConfidenceEligible: true,
      },
      {
        items: sameType.filter(
          (item) => item.assigneeId === workItem.assigneeId
        ),
        source: 'assignee_history',
        description: 'same-project, same-type items assigned to this assignee',
        highConfidenceEligible: true,
        mediumConfidenceEligible: true,
      }
    );
  }

  const targetSeniority = normalized(workItem.assigneeSeniority);
  if (targetSeniority) {
    pools.push({
      items: comparable.filter((item) => {
        return normalized(item.assigneeSeniority) === targetSeniority;
      }),
      source: 'experience_history',
      description: 'comparable items with matching seniority',
      highConfidenceEligible: false,
      mediumConfidenceEligible: true,
    });
  }

  pools.push({
    items: comparable,
    source: 'similar_history',
    description: 'comparable same-project, same-type items',
    highConfidenceEligible: true,
    mediumConfidenceEligible: true,
  });

  pools.push(
    {
      items: sameType,
      source: 'similar_history',
      description: 'same-project, same-type items',
      highConfidenceEligible: false,
      mediumConfidenceEligible: true,
    },
    {
      items: usable,
      source: 'project_history',
      description: 'completed items from this project',
      highConfidenceEligible: false,
      mediumConfidenceEligible: false,
    }
  );

  return (
    pools.find(
      (pool) => pool.items.length >= SPRINT_ESTIMATION_MIN_HISTORY_SAMPLES
    ) ?? null
  );
}

function confidenceForPool(pool: EvidencePool): SprintEstimationConfidence {
  if (
    pool.highConfidenceEligible &&
    pool.items.length >= SPRINT_ESTIMATION_HIGH_CONFIDENCE_SAMPLES
  ) {
    return 'high';
  }
  if (pool.mediumConfidenceEligible) {
    return 'medium';
  }
  return 'low';
}

function medianCompletionRate(
  completions: readonly PreviousSprintCompletion[]
): number | null {
  return median(
    completions
      .filter((completion) => completion.committedStoryPoints > 0)
      .map((completion) => {
        return Math.min(
          1,
          completion.completedStoryPoints / completion.committedStoryPoints
        );
      })
  );
}

function completionRangeMultiplier(completionRate: number | null): number {
  // Delivery below 90% adds 10% upper-range contingency; below 75% adds 20%.
  if (completionRate === null || completionRate >= 0.9) {
    return 1;
  }
  return completionRate < 0.75 ? 1.2 : 1.1;
}

function withBoundedRange(
  suggested: number,
  minimum: number,
  maximum: number
): Pick<
  SprintWorkItemEstimate,
  'suggestedHours' | 'minimumHours' | 'maximumHours'
> {
  const suggestedHours = boundedHours(suggested);
  return {
    suggestedHours,
    minimumHours: Math.min(suggestedHours, boundedHours(minimum)),
    maximumHours: Math.max(suggestedHours, boundedHours(maximum)),
  };
}

/**
 * Produces a deterministic planning estimate from already-aggregated history.
 * Repository concerns (querying and work-log aggregation) intentionally live
 * outside this pure function.
 */
export function estimateSprintWorkItem(
  input: SprintEstimationInput
): SprintWorkItemEstimate {
  const pool = selectEvidencePool(input);
  const completionRate = medianCompletionRate(input.previousSprintCompletions);
  const completionMultiplier = completionRangeMultiplier(completionRate);
  const completionRationale =
    completionMultiplier > 1 && completionRate !== null
      ? ` Upper range widened for ${Math.round(completionRate * 100)}% median sprint completion.`
      : '';

  if (!pool) {
    const hasStoryPoints = (input.workItem.storyPoints ?? 0) > 0;
    const suggested = hasStoryPoints
      ? input.workItem.storyPoints!
      : ROUGH_HOURS_BY_TYPE[input.workItem.type];
    const range = withBoundedRange(
      suggested,
      suggested * 0.75,
      suggested * 1.5 * completionMultiplier
    );
    const fallbackBasis = hasStoryPoints
      ? 'the 1 story point to 1 hour fallback'
      : `the ${input.workItem.type} type-based fallback`;

    return {
      workItemId: input.workItem.id,
      ...range,
      confidence: 'low',
      source: 'rough_fallback',
      evidenceCount: 0,
      roughEstimate: true,
      rationale: `Rough estimate using ${fallbackBasis}; fewer than ${SPRINT_ESTIMATION_MIN_HISTORY_SAMPLES} usable historical items were available.${completionRationale}`,
    };
  }

  const useHoursPerPoint = (input.workItem.storyPoints ?? 0) > 0;
  const observations = pool.items.map((item) => {
    if (useHoursPerPoint) {
      return (
        (item.loggedHours / item.storyPoints!) * input.workItem.storyPoints!
      );
    }
    return item.loggedHours;
  });
  const suggested = median(observations)!;
  const lowerQuartile = percentile(observations, 0.25);
  const upperQuartile = percentile(observations, 0.75);
  const halfWidth = Math.max(
    suggested * 0.2,
    suggested - lowerQuartile,
    upperQuartile - suggested,
    0.5
  );
  const range = withBoundedRange(
    suggested,
    suggested - halfWidth,
    (suggested + halfWidth) * completionMultiplier
  );
  const medianBasis = useHoursPerPoint
    ? 'median hours per story point'
    : 'median completed hours';

  return {
    workItemId: input.workItem.id,
    ...range,
    confidence: confidenceForPool(pool),
    source: pool.source,
    evidenceCount: pool.items.length,
    roughEstimate: false,
    rationale: `Based on ${medianBasis} from ${pool.items.length} ${pool.description}.${completionRationale}`,
  };
}
