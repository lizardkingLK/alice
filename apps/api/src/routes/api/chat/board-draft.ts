import { z } from 'zod';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import {
  boardConfigSchema,
  boardRuleMatcherSchema,
  type BoardConfig,
} from '@repo/types/api/v1';

const draftColumnSchema = z
  .object({
    existingColumnId: z.string().trim().min(1).optional(),
    temporaryKey: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    status: z.enum(BOARD_WORK_ITEM_STATUSES),
  })
  .superRefine((column, context) => {
    if (Boolean(column.existingColumnId) === Boolean(column.temporaryKey)) {
      context.addIssue({
        code: 'custom',
        message:
          'Each column must have exactly one existingColumnId or temporaryKey.',
      });
    }
  });

const draftTransitionSchema = z.object({
  fromColumnRef: z.string().trim().min(1),
  toColumnRef: z.string().trim().min(1),
  allowAnyOf: z.array(boardRuleMatcherSchema).min(1),
});

export const configureBoardDraftInputSchema = z.object({
  projectId: z.string().trim().min(1),
  columns: z.array(draftColumnSchema).min(1),
  transitions: z.array(draftTransitionSchema).optional(),
});

export type ConfigureBoardDraftInput = z.infer<
  typeof configureBoardDraftInputSchema
>;

function validationErrorMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

/**
 * Convert provider output into a validated BoardConfig without trusting model
 * IDs. Existing IDs must belong to the stored config; new IDs are generated
 * here and temporary references never leave this function.
 */
export function buildBoardDraft(
  currentConfig: BoardConfig | null,
  rawInput: unknown,
  generateId: () => string = () => globalThis.crypto.randomUUID()
): { readonly config: BoardConfig; readonly input: ConfigureBoardDraftInput } {
  const parsedInput = configureBoardDraftInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    throw new Error(
      `Board draft input is invalid: ${validationErrorMessage(parsedInput.error)}`
    );
  }

  const input = parsedInput.data;
  const existingIds = new Set(
    currentConfig?.columns.map((column) => column.id) ?? []
  );
  const temporaryKeys = new Set<string>();
  const referenceIds = new Map<string, string>();

  const columns = input.columns.map((column, index) => {
    if (column.existingColumnId) {
      if (!existingIds.has(column.existingColumnId)) {
        throw new Error(
          `columns.${index}.existingColumnId is not part of the current board.`
        );
      }
      referenceIds.set(column.existingColumnId, column.existingColumnId);
      return {
        id: column.existingColumnId,
        name: column.name,
        status: column.status,
      };
    }

    const temporaryKey = column.temporaryKey!;
    if (temporaryKeys.has(temporaryKey)) {
      throw new Error(`Duplicate temporary column key: ${temporaryKey}`);
    }
    temporaryKeys.add(temporaryKey);
    const id = generateId();
    referenceIds.set(temporaryKey, id);
    return { id, name: column.name, status: column.status };
  });

  const resolveColumnRef = (ref: string, path: string): string => {
    const id = referenceIds.get(ref);
    if (!id) {
      throw new Error(`${path} does not reference a column in this draft.`);
    }
    return id;
  };

  const requestedTransitions = input.transitions?.map((transition, index) => ({
    fromColumnId: resolveColumnRef(
      transition.fromColumnRef,
      `transitions.${index}.fromColumnRef`
    ),
    toColumnId: resolveColumnRef(
      transition.toColumnRef,
      `transitions.${index}.toColumnRef`
    ),
    allowAnyOf: transition.allowAnyOf,
  }));

  const includedColumnIds = new Set(columns.map((column) => column.id));
  const transitions =
    requestedTransitions ??
    (currentConfig?.version === '2'
      ? currentConfig.transitions.filter(
          (transition) =>
            includedColumnIds.has(transition.fromColumnId) &&
            includedColumnIds.has(transition.toColumnId)
        )
      : []);

  const shouldUseV2 = currentConfig?.version === '2' || transitions.length > 0;
  const candidate = shouldUseV2
    ? { version: '2' as const, columns, transitions }
    : { version: '1' as const, columns };

  const parsedConfig = boardConfigSchema.safeParse(candidate);
  if (!parsedConfig.success) {
    throw new Error(
      `Board configuration is invalid: ${validationErrorMessage(parsedConfig.error)}`
    );
  }

  return { config: parsedConfig.data, input };
}
