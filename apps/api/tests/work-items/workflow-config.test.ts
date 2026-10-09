import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_ID,
  WorkItemStatusEnum,
  createSeededDefaultWorkflowConfig,
  parseWorkflowConfigEnvelope,
  resolveWorkflowConfig,
  workflowConfigEnvelopeSchema,
} from '@repo/types';

describe('workflowConfigEnvelopeSchema', () => {
  it('accepts the seeded default envelope', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const parsed = workflowConfigEnvelopeSchema.safeParse(seeded);
    expect(parsed.success).toBe(true);
    expect(seeded.defaultWorkflowId).toBe(DEFAULT_WORKFLOW_ID);
    expect(seeded.workflows[0]?.graph.states.length).toBeGreaterThan(0);
  });

  it('rejects self-loop edges', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const workflow = seeded.workflows[0]!;
    workflow.graph.edges.push({
      id: 'loop',
      from: WorkItemStatusEnum.ToDo,
      to: WorkItemStatusEnum.ToDo,
      allowAnyOf: [],
      requiresEscalation: false,
      resolutionPresetId: null,
      requireChildren: 'off',
    });
    expect(workflowConfigEnvelopeSchema.safeParse(seeded).success).toBe(false);
  });

  it('rejects duplicate directed edges', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const workflow = seeded.workflows[0]!;
    const first = workflow.graph.edges[0]!;
    workflow.graph.edges.push({
      ...first,
      id: 'dup-edge',
    });
    expect(workflowConfigEnvelopeSchema.safeParse(seeded).success).toBe(false);
  });

  it('rejects forking a fork (depth > 1)', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    seeded.workflows.push({
      ...structuredClone(seeded.workflows[0]!),
      id: 'wf-fork',
      title: 'Fork',
      forkedFromId: DEFAULT_WORKFLOW_ID,
      typeBindings: [],
    });
    seeded.workflows.push({
      ...structuredClone(seeded.workflows[0]!),
      id: 'wf-fork-2',
      title: 'Fork of fork',
      forkedFromId: 'wf-fork',
      typeBindings: [],
    });
    expect(workflowConfigEnvelopeSchema.safeParse(seeded).success).toBe(false);
  });

  it('rejects overlapping type bindings', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    seeded.workflows.push({
      ...structuredClone(seeded.workflows[0]!),
      id: 'wf-bug',
      title: 'Bug',
      forkedFromId: DEFAULT_WORKFLOW_ID,
      typeBindings: ['Story'],
    });
    expect(workflowConfigEnvelopeSchema.safeParse(seeded).success).toBe(false);
  });

  it('rejects terminal states that still have outbound edges', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const done = seeded.workflows[0]!.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.Done
    )!;
    done.terminal = true;
    seeded.workflows[0]!.graph.edges.push({
      id: 'reopen',
      from: WorkItemStatusEnum.Done,
      to: WorkItemStatusEnum.ToDo,
      allowAnyOf: [],
      requiresEscalation: false,
      resolutionPresetId: null,
      requireChildren: 'off',
    });
    expect(workflowConfigEnvelopeSchema.safeParse(seeded).success).toBe(false);
  });
});

describe('resolveWorkflowConfig', () => {
  it('returns seeded default for null / board-only / garbage', () => {
    expect(resolveWorkflowConfig(null).usedFallback).toBe(true);
    expect(
      resolveWorkflowConfig({
        version: '1',
        columns: [{ id: 'new', name: 'New', status: 'New' }],
      }).usedFallback
    ).toBe(true);
    expect(resolveWorkflowConfig('nope').usedFallback).toBe(true);
    expect(parseWorkflowConfigEnvelope(null)).toBeNull();
  });

  it('returns parsed envelope without fallback when valid', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const resolved = resolveWorkflowConfig(seeded);
    expect(resolved.usedFallback).toBe(false);
    expect(resolved.config.defaultWorkflowId).toBe(DEFAULT_WORKFLOW_ID);
  });

  it('accepts envelope merged with legacy work_item_types', () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const merged = {
      ...seeded,
      work_item_types: ['Epic', 'Story', 'Task', 'Issue'],
    };
    const resolved = resolveWorkflowConfig(merged);
    expect(resolved.usedFallback).toBe(false);
  });
});
