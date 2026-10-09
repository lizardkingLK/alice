import { describe, expect, it } from 'vitest';
import {
  buildEscalationResolvedMeta,
  createEmptyResolutionPreset,
  createSeededDefaultWorkflowConfig,
  ensureUniqueResolutionEntityIds,
  getResolutionRequirement,
  upsertResolutionPreset,
  validateResolutionPayload,
} from '@repo/types/api/v1';

describe('workflow-resolution', () => {
  const preset = createEmptyResolutionPreset('preset-1', 'Close reason');
  const withFields = {
    ...preset,
    fields: [
      {
        id: 'reason',
        type: 'text' as const,
        label: 'Reason',
        required: true,
      },
      {
        id: 'done',
        type: 'checkbox' as const,
        label: 'Confirmed',
        required: false,
      },
    ],
    outcomes: [{ id: 'fixed', label: 'Fixed' }],
  };

  it('requires a preset when the edge references one', () => {
    const edge = {
      id: 'e1',
      from: 'a',
      to: 'b',
      allowAnyOf: [],
      requiresEscalation: false,
      resolutionPresetId: 'preset-1',
      requireChildren: 'off' as const,
    };
    const source = {
      id: 'a',
      name: 'A',
      category: 'todo' as const,
      lockRecord: false,
      terminal: false,
      requiresEscalation: false,
    };
    expect(getResolutionRequirement(edge, source)).toEqual({
      required: true,
      presetId: 'preset-1',
    });
  });

  it('validates required answers and outcomes', () => {
    expect(
      validateResolutionPayload(withFields, {
        presetId: 'preset-1',
        answers: [],
      })
    ).toMatchObject({ ok: false });

    expect(
      validateResolutionPayload(withFields, {
        presetId: 'preset-1',
        outcomeId: 'fixed',
        answers: [{ fieldId: 'reason', value: 'Done' }],
      })
    ).toEqual({ ok: true });
  });

  it('upserts presets onto a workflow document', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const next = upsertResolutionPreset(workflow, withFields);
    expect(next.resolutionPresets).toHaveLength(1);
    expect(next.resolutionPresets[0]?.title).toBe('Close reason');
  });

  it('regenerates duplicate field and outcome ids', () => {
    const duplicated = ensureUniqueResolutionEntityIds({
      ...withFields,
      fields: [
        ...withFields.fields,
        {
          id: 'reason',
          type: 'text' as const,
          label: 'Copied reason',
          required: false,
        },
      ],
      outcomes: [
        { id: 'fixed', label: 'Fixed' },
        { id: 'fixed', label: "Won't Fix" },
        { id: 'moved', label: 'Moved' },
      ],
    });

    const fieldIds = duplicated.fields.map((field) => field.id);
    const outcomeIds = duplicated.outcomes.map((outcome) => outcome.id);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
    expect(new Set(outcomeIds).size).toBe(outcomeIds.length);
    expect(duplicated.fields[0]?.id).toBe('reason');
    expect(duplicated.outcomes[0]?.id).toBe('fixed');
    expect(duplicated.outcomes[1]?.id).not.toBe('fixed');
    expect(duplicated.outcomes[2]?.id).toBe('moved');
  });

  it('dedupes entity ids when upserting a pasted preset', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const next = upsertResolutionPreset(workflow, {
      ...withFields,
      outcomes: [
        { id: 'fixed', label: 'Fixed' },
        { id: 'fixed', label: "Won't Fix" },
      ],
    });
    const outcomeIds = next.resolutionPresets[0]!.outcomes.map(
      (outcome) => outcome.id
    );
    expect(new Set(outcomeIds).size).toBe(2);
  });

  it('builds an activity snapshot', () => {
    const meta = buildEscalationResolvedMeta({
      preset: withFields,
      payload: {
        presetId: 'preset-1',
        outcomeId: 'fixed',
        answers: [{ fieldId: 'reason', value: 'Shipped' }],
      },
      workflowId: 'wf-default',
      edgeId: 'e1',
      fromStateId: 'a',
      toStateId: 'b',
    });
    expect(meta.presetTitle).toBe('Close reason');
    expect(meta.outcomeLabel).toBe('Fixed');
    expect(meta.fields[0]?.value).toBe('Shipped');
  });
});
