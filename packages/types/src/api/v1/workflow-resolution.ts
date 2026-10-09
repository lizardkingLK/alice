import { z } from 'zod';
import { createPrefixedId } from '../../crypto-id.js';
import {
  workflowResolutionFieldSchema,
  workflowResolutionPresetSchema,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowResolutionPreset,
  type WorkflowStateNode,
} from './workflow-config.js';

/** Client/API payload when leaving a state that requires a resolution form. */
export const workflowResolutionAnswerSchema = z.object({
  fieldId: z.string().trim().min(1),
  value: z.union([z.string(), z.boolean(), z.null()]),
});

export const workflowResolutionPayloadSchema = z.object({
  presetId: z.string().trim().min(1),
  outcomeId: z.string().trim().min(1).nullable().optional(),
  answers: z.array(workflowResolutionAnswerSchema).default([]),
});

export type WorkflowResolutionAnswer = z.infer<
  typeof workflowResolutionAnswerSchema
>;
export type WorkflowResolutionPayload = z.infer<
  typeof workflowResolutionPayloadSchema
>;

export type ResolutionRequirement =
  | { readonly required: false }
  | { readonly required: true; readonly presetId: string }
  | { readonly required: true; readonly presetId: null };

export function getResolutionRequirement(
  edge: WorkflowEdge | null,
  sourceState: WorkflowStateNode
): ResolutionRequirement {
  if (!edge) {
    return { required: false };
  }
  if (edge.resolutionPresetId) {
    return { required: true, presetId: edge.resolutionPresetId };
  }
  if (edge.requiresEscalation || sourceState.requiresEscalation) {
    return { required: true, presetId: null };
  }
  return { required: false };
}

export function findResolutionPreset(
  workflow: WorkflowDocument,
  presetId: string
): WorkflowResolutionPreset | null {
  return (
    workflow.resolutionPresets.find((preset) => preset.id === presetId) ?? null
  );
}

export function createEmptyResolutionPreset(
  id: string,
  title = 'New preset'
): WorkflowResolutionPreset {
  return workflowResolutionPresetSchema.parse({
    id,
    title,
    fields: [],
    outcomes: [],
  });
}

export function cloneResolutionPreset(
  preset: WorkflowResolutionPreset,
  newId: string,
  title?: string
): WorkflowResolutionPreset {
  return workflowResolutionPresetSchema.parse({
    ...preset,
    id: newId,
    title: title ?? `${preset.title} (copy)`,
  });
}

function newResolutionEntityId(prefix: 'field' | 'outcome'): string {
  return createPrefixedId(prefix);
}

/**
 * Keep the first occurrence of each field/outcome id; regenerate duplicates
 * (e.g. after a blind JSON copy-paste). Safe for Apply / upsert.
 */
export function ensureUniqueResolutionEntityIds(
  preset: WorkflowResolutionPreset
): WorkflowResolutionPreset {
  const seenFieldIds = new Set<string>();
  const fields = preset.fields.map((field) => {
    const trimmed = field.id.trim();
    if (trimmed && !seenFieldIds.has(trimmed)) {
      seenFieldIds.add(trimmed);
      return trimmed === field.id ? field : { ...field, id: trimmed };
    }
    const id = newResolutionEntityId('field');
    seenFieldIds.add(id);
    return { ...field, id };
  });

  const seenOutcomeIds = new Set<string>();
  const outcomes = preset.outcomes.map((outcome) => {
    const trimmed = outcome.id.trim();
    if (trimmed && !seenOutcomeIds.has(trimmed)) {
      seenOutcomeIds.add(trimmed);
      return trimmed === outcome.id ? outcome : { ...outcome, id: trimmed };
    }
    const id = newResolutionEntityId('outcome');
    seenOutcomeIds.add(id);
    return { ...outcome, id };
  });

  return { ...preset, fields, outcomes };
}

/** Replace or append a preset on the workflow document. */
export function upsertResolutionPreset(
  workflow: WorkflowDocument,
  preset: WorkflowResolutionPreset
): WorkflowDocument {
  const parsed = ensureUniqueResolutionEntityIds(
    workflowResolutionPresetSchema.parse(preset)
  );
  const index = workflow.resolutionPresets.findIndex(
    (candidate) => candidate.id === parsed.id
  );
  const nextPresets =
    index === -1
      ? [...workflow.resolutionPresets, parsed]
      : workflow.resolutionPresets.map((candidate, i) =>
          i === index ? parsed : candidate
        );
  return {
    ...workflow,
    resolutionPresets: nextPresets,
  };
}

export type ResolutionValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

type ResolutionField = WorkflowResolutionPreset['fields'][number];
type ResolutionAnswerValue =
  WorkflowResolutionPayload['answers'][number]['value'];

function failValidation(message: string): ResolutionValidationResult {
  return { ok: false, message };
}

function validateResolutionOutcome(
  preset: WorkflowResolutionPreset,
  outcomeId: string | null | undefined
): ResolutionValidationResult {
  if (preset.outcomes.length === 0) {
    return { ok: true };
  }
  if (!outcomeId) {
    return failValidation('Select an outcome');
  }
  if (!preset.outcomes.some((outcome) => outcome.id === outcomeId)) {
    return failValidation('Unknown resolution outcome');
  }
  return { ok: true };
}

function isMissingRequiredValue(
  field: ResolutionField,
  value: ResolutionAnswerValue | undefined
): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  return field.type === 'checkbox' && value !== true && value !== false;
}

function validateRequiredField(
  field: ResolutionField,
  value: ResolutionAnswerValue | undefined
): ResolutionValidationResult {
  if (!field.required) {
    return { ok: true };
  }
  if (isMissingRequiredValue(field, value)) {
    return failValidation(`"${field.label}" is required`);
  }
  return { ok: true };
}

function validateFieldValueType(
  field: ResolutionField,
  value: ResolutionAnswerValue
): ResolutionValidationResult {
  if (field.type === 'checkbox') {
    return typeof value === 'boolean'
      ? { ok: true }
      : failValidation(`"${field.label}" must be yes or no`);
  }

  if (typeof value !== 'string') {
    return failValidation(`"${field.label}" must be text`);
  }

  if (
    field.type === 'select' &&
    field.options &&
    field.options.length > 0 &&
    !field.options.includes(value)
  ) {
    return failValidation(`"${field.label}" has an invalid option`);
  }

  return { ok: true };
}

function validateResolutionFields(
  preset: WorkflowResolutionPreset,
  answersByField: Map<string, ResolutionAnswerValue>
): ResolutionValidationResult {
  for (const field of preset.fields) {
    const value = answersByField.get(field.id);
    const requiredCheck = validateRequiredField(field, value);
    if (!requiredCheck.ok) {
      return requiredCheck;
    }
    if (value === undefined || value === null) {
      continue;
    }
    const typeCheck = validateFieldValueType(field, value);
    if (!typeCheck.ok) {
      return typeCheck;
    }
  }
  return { ok: true };
}

function validateUnknownAnswers(
  preset: WorkflowResolutionPreset,
  payload: WorkflowResolutionPayload
): ResolutionValidationResult {
  const fieldIds = new Set(preset.fields.map((field) => field.id));
  for (const answer of payload.answers) {
    if (!fieldIds.has(answer.fieldId)) {
      return failValidation('Unknown resolution field answer');
    }
  }
  return { ok: true };
}

export function validateResolutionPayload(
  preset: WorkflowResolutionPreset,
  payload: WorkflowResolutionPayload
): ResolutionValidationResult {
  if (payload.presetId !== preset.id) {
    return failValidation('Resolution preset does not match this transition');
  }

  const outcomeCheck = validateResolutionOutcome(preset, payload.outcomeId);
  if (!outcomeCheck.ok) {
    return outcomeCheck;
  }

  const answersByField = new Map(
    payload.answers.map((answer) => [answer.fieldId, answer.value])
  );
  const fieldsCheck = validateResolutionFields(preset, answersByField);
  if (!fieldsCheck.ok) {
    return fieldsCheck;
  }

  return validateUnknownAnswers(preset, payload);
}

/** Snapshot stored on activity when a resolution form is submitted. */
export type EscalationResolvedMeta = {
  readonly presetId: string;
  readonly presetTitle: string;
  readonly outcomeId: string | null;
  readonly outcomeLabel: string | null;
  readonly fields: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly type: z.infer<typeof workflowResolutionFieldSchema>['type'];
    readonly value: string | boolean | null;
  }>;
  readonly workflowId: string;
  readonly edgeId: string | null;
  readonly fromStateId: string;
  readonly toStateId: string;
};

export function buildEscalationResolvedMeta(params: {
  readonly preset: WorkflowResolutionPreset;
  readonly payload: WorkflowResolutionPayload;
  readonly workflowId: string;
  readonly edgeId: string | null;
  readonly fromStateId: string;
  readonly toStateId: string;
}): EscalationResolvedMeta {
  const outcome =
    params.payload.outcomeId == null
      ? null
      : (params.preset.outcomes.find(
          (item) => item.id === params.payload.outcomeId
        ) ?? null);
  const answersByField = new Map(
    params.payload.answers.map((answer) => [answer.fieldId, answer.value])
  );

  return {
    presetId: params.preset.id,
    presetTitle: params.preset.title,
    outcomeId: outcome?.id ?? null,
    outcomeLabel: outcome?.label ?? null,
    fields: params.preset.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      value: answersByField.has(field.id)
        ? (answersByField.get(field.id) ?? null)
        : null,
    })),
    workflowId: params.workflowId,
    edgeId: params.edgeId,
    fromStateId: params.fromStateId,
    toStateId: params.toStateId,
  };
}

export {
  workflowResolutionFieldSchema,
  workflowResolutionOutcomeSchema,
  workflowResolutionPresetSchema,
} from './workflow-config.js';
