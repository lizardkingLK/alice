import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import {
  BOARD_WORK_ITEM_STATUSES,
  WORK_ITEM_STATUSES,
  type WorkItemStatus,
} from '../../work-item-status.js';

export const BOARD_MOVE_FORBIDDEN_CODE = 'BOARD_MOVE_FORBIDDEN' as const;

const boardWorkItemStatusSchema = z.enum(BOARD_WORK_ITEM_STATUSES, {
  message: 'Please select a valid board status',
});

const workflowWorkItemStatusSchema = z.enum(WORK_ITEM_STATUSES, {
  message: 'Please select a valid work item status',
});

export const boardColumnSchema = z.object({
  id: z.string().trim().min(1, 'Column ID is required'),
  name: z.string().trim().min(1, 'Column name is required'),
  status: boardWorkItemStatusSchema,
});

export const boardRuleMatcherSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('role'),
    role: z.enum(Constants.public.Enums.UserRole),
  }),
  z.object({
    scope: z.literal('team'),
    teamId: z.uuid('Team ID must be a valid UUID'),
  }),
  z.object({
    scope: z.literal('user'),
    userId: z.uuid('User ID must be a valid UUID'),
  }),
]);

function matcherKey(matcher: z.infer<typeof boardRuleMatcherSchema>): string {
  if (matcher.scope === 'role') return `role:${matcher.role}`;
  if (matcher.scope === 'team') return `team:${matcher.teamId.toLowerCase()}`;
  return `user:${matcher.userId.toLowerCase()}`;
}

function validateUniqueMatchers(
  allowAnyOf: z.infer<typeof boardRuleMatcherSchema>[],
  context: z.RefinementCtx
): void {
  const keys = allowAnyOf.map(matcherKey);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: 'custom',
      path: ['allowAnyOf'],
      message: 'Transition matchers must be unique',
    });
  }
}

export const boardTransitionSchema = z
  .object({
    fromColumnId: z.string().trim().min(1, 'Source column ID is required'),
    toColumnId: z.string().trim().min(1, 'Destination column ID is required'),
    allowAnyOf: z
      .array(boardRuleMatcherSchema)
      .min(1, 'Restricted transitions must allow at least one matcher'),
  })
  .superRefine((transition, context) => {
    if (transition.fromColumnId === transition.toColumnId) {
      context.addIssue({
        code: 'custom',
        path: ['toColumnId'],
        message: 'Source and destination columns must be different',
      });
    }

    validateUniqueMatchers(transition.allowAnyOf, context);
  });

export const workItemStatusTransitionSchema = z
  .object({
    fromStatus: workflowWorkItemStatusSchema,
    toStatus: workflowWorkItemStatusSchema,
    allowAnyOf: z
      .array(boardRuleMatcherSchema)
      .min(1, 'Restricted transitions must allow at least one matcher'),
  })
  .superRefine((transition, context) => {
    if (transition.fromStatus === transition.toStatus) {
      context.addIssue({
        code: 'custom',
        path: ['toStatus'],
        message: 'Source and destination statuses must be different',
      });
    }

    validateUniqueMatchers(transition.allowAnyOf, context);
  });

const boardColumnsSchema = z
  .array(boardColumnSchema)
  .min(1, 'Board must have at least one column')
  .refine(
    (columns) =>
      new Set(columns.map((column) => column.id)).size === columns.length,
    'Column IDs must be unique'
  );

function validateStatusCoverage(
  columns: z.infer<typeof boardColumnsSchema>,
  context: z.RefinementCtx
): void {
  for (const status of BOARD_WORK_ITEM_STATUSES) {
    if (!columns.some((column) => column.status === status)) {
      context.addIssue({
        code: 'custom',
        path: ['columns'],
        message: `Board must include at least one column mapped to ${status}`,
      });
    }
  }
}

export const boardConfigV1Schema = z
  .object({
    version: z.literal('1'),
    columns: boardColumnsSchema,
  })
  .superRefine((config, context) => {
    validateStatusCoverage(config.columns, context);
  });

export const boardConfigV2Schema = z
  .object({
    version: z.literal('2'),
    columns: boardColumnsSchema,
    transitions: z.array(boardTransitionSchema),
    statusTransitions: z.array(workItemStatusTransitionSchema).optional(),
  })
  .superRefine((config, context) => {
    validateStatusCoverage(config.columns, context);

    const columnIds = new Set(config.columns.map((column) => column.id));
    const transitionPairs = new Set<string>();
    const statusTransitionPairs = new Set<string>();

    config.transitions.forEach((transition, index) => {
      if (!columnIds.has(transition.fromColumnId)) {
        context.addIssue({
          code: 'custom',
          path: ['transitions', index, 'fromColumnId'],
          message: 'Source column must exist in this board',
        });
      }
      if (!columnIds.has(transition.toColumnId)) {
        context.addIssue({
          code: 'custom',
          path: ['transitions', index, 'toColumnId'],
          message: 'Destination column must exist in this board',
        });
      }

      const pair = `${transition.fromColumnId}\u0000${transition.toColumnId}`;
      if (transitionPairs.has(pair)) {
        context.addIssue({
          code: 'custom',
          path: ['transitions', index],
          message: 'Only one rule is allowed for each board transition',
        });
      }
      transitionPairs.add(pair);
    });

    config.statusTransitions?.forEach((transition, index) => {
      const pair = `${transition.fromStatus}\u0000${transition.toStatus}`;
      if (statusTransitionPairs.has(pair)) {
        context.addIssue({
          code: 'custom',
          path: ['statusTransitions', index],
          message: 'Only one rule is allowed for each status transition',
        });
      }
      statusTransitionPairs.add(pair);
    });
  });

/** Persisted board configuration. Version 1 intentionally has no rules. */
export const boardConfigSchema = z.union([
  boardConfigV1Schema,
  boardConfigV2Schema,
]);

export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type BoardRuleMatcher = z.infer<typeof boardRuleMatcherSchema>;
export type BoardTransition = z.infer<typeof boardTransitionSchema>;
export type WorkItemStatusTransition = z.infer<
  typeof workItemStatusTransitionSchema
>;
export type BoardConfigV1 = z.infer<typeof boardConfigV1Schema>;
export type BoardConfigV2 = z.infer<typeof boardConfigV2Schema>;
export type BoardConfig = z.infer<typeof boardConfigSchema>;

export type RuntimeBoardConfig = {
  readonly version: BoardConfig['version'];
  readonly columns: BoardColumn[];
  readonly transitions: BoardTransition[];
  readonly statusTransitions: WorkItemStatusTransition[];
};

/** Add runtime defaults without changing persisted version-1 JSON. */
export function normalizeBoardConfig(config: BoardConfig): RuntimeBoardConfig {
  return {
    version: config.version,
    columns: config.columns,
    transitions: config.version === '2' ? config.transitions : [],
    statusTransitions:
      config.version === '2' ? (config.statusTransitions ?? []) : [],
  };
}

type BoardPlacement = {
  readonly status: string;
  readonly board_column_id?: string | null;
};

/** Resolve stored placement; stale IDs fall back to the first status column. */
export function resolveBoardSourceColumn(
  placement: BoardPlacement,
  columns: readonly BoardColumn[]
): BoardColumn | null {
  const exact = placement.board_column_id
    ? columns.find(
        (column) =>
          column.id === placement.board_column_id &&
          column.status === placement.status
      )
    : undefined;

  return (
    exact ??
    columns.find((column) => column.status === placement.status) ??
    null
  );
}

/** Resolve an exact destination, or the first status column when the ID is null. */
export function resolveBoardDestinationColumn(
  placement: BoardPlacement,
  columns: readonly BoardColumn[]
): BoardColumn | null {
  if (placement.board_column_id) {
    return (
      columns.find(
        (column) =>
          column.id === placement.board_column_id &&
          column.status === placement.status
      ) ?? null
    );
  }

  return columns.find((column) => column.status === placement.status) ?? null;
}

export function findBoardTransition(
  config: RuntimeBoardConfig,
  fromColumnId: string,
  toColumnId: string
): BoardTransition | null {
  return (
    config.transitions.find(
      (transition) =>
        transition.fromColumnId === fromColumnId &&
        transition.toColumnId === toColumnId
    ) ?? null
  );
}

export function findStatusTransition(
  config: RuntimeBoardConfig,
  fromStatus: WorkItemStatus,
  toStatus: WorkItemStatus
): WorkItemStatusTransition | null {
  return (
    config.statusTransitions.find(
      (transition) =>
        transition.fromStatus === fromStatus && transition.toStatus === toStatus
    ) ?? null
  );
}
