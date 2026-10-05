import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import { boardRuleMatcherSchema } from './board-config.js';
import {
  DEFAULT_WORKFLOW_ID,
  WORKFLOW_STATE_CATEGORIES,
  categoryFromWorkItemStatus,
} from '../../work-item-state.js';
import {
  BOARD_WORK_ITEM_STATUSES,
  WorkItemStatusEnum,
  type WorkItemStatus,
} from '../../work-item-status.js';
import { WorkItemTypeEnum, type WorkItemType } from '../../work-item-types.js';

export const WORKFLOW_CONFIG_SCHEMA_VERSION = 1 as const;

export const WORKFLOW_REQUIRE_CHILDREN = [
  'off',
  'all_complete',
  'match_parent_target',
] as const;

export type WorkflowRequireChildren =
  (typeof WORKFLOW_REQUIRE_CHILDREN)[number];

const workItemTypeSchema = z.enum(Constants.public.Enums.WorkItemType);

const workflowStateCategorySchema = z.enum(WORKFLOW_STATE_CATEGORIES);

export const workflowResolutionFieldSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(['text', 'textarea', 'select', 'checkbox']),
  label: z.string().trim().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export const workflowResolutionOutcomeSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
});

/** MVP preset shape (full designer in Step 6). */
export const workflowResolutionPresetSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  fields: z.array(workflowResolutionFieldSchema).default([]),
  outcomes: z.array(workflowResolutionOutcomeSchema).default([]),
});

export const workflowStateNodeSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: workflowStateCategorySchema,
  lockRecord: z.boolean().default(false),
  terminal: z.boolean().default(false),
  requiresEscalation: z.boolean().default(false),
});

export const workflowEdgeSchema = z
  .object({
    id: z.string().trim().min(1),
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
    allowAnyOf: z.array(boardRuleMatcherSchema).default([]),
    resolutionPresetId: z.string().trim().min(1).nullable().default(null),
    requireChildren: z.enum(WORKFLOW_REQUIRE_CHILDREN).default('off'),
  })
  .superRefine((edge, context) => {
    if (edge.from === edge.to) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Self-loop edges are not allowed',
      });
    }

    const keys = edge.allowAnyOf.map((matcher) => {
      if (matcher.scope === 'role') return `role:${matcher.role}`;
      if (matcher.scope === 'team') return `team:${matcher.teamId}`;
      return `user:${matcher.userId}`;
    });
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: 'custom',
        path: ['allowAnyOf'],
        message: 'Transition matchers must be unique',
      });
    }
  });

export const workflowLayoutSchema = z
  .object({
    nodes: z.record(z.string(), z.unknown()).default({}),
    edges: z.record(z.string(), z.unknown()).default({}),
  })
  .default({ nodes: {}, edges: {} });

export const workflowGraphSchema = z.object({
  states: z
    .array(workflowStateNodeSchema)
    .min(1, 'Workflow needs at least one state'),
  edges: z.array(workflowEdgeSchema).default([]),
});

export const workflowDocumentSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().default(''),
  forkedFromId: z.string().trim().min(1).nullable().default(null),
  typeBindings: z.array(workItemTypeSchema).default([]),
  graph: workflowGraphSchema,
  layout: workflowLayoutSchema,
  resolutionPresets: z.array(workflowResolutionPresetSchema).default([]),
});

type WorkflowDocumentValue = z.infer<typeof workflowDocumentSchema>;
type WorkflowEdgeValue = WorkflowDocumentValue['graph']['edges'][number];

function addCustomIssue(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string
): void {
  context.addIssue({ code: 'custom', path, message });
}

function validateUniqueStateIds(
  workflow: WorkflowDocumentValue,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[]
): Set<string> {
  const stateIds = workflow.graph.states.map((state) => state.id);
  if (new Set(stateIds).size !== stateIds.length) {
    addCustomIssue(
      context,
      [...pathPrefix, 'graph', 'states'],
      'State IDs must be unique within a workflow'
    );
  }
  return new Set(stateIds);
}

function validateWorkflowEdges(
  workflow: WorkflowDocumentValue,
  stateIdSet: Set<string>,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[]
): void {
  const edgeIds = new Set<string>();
  const directedPairs = new Set<string>();

  for (const [edgeIndex, edge] of workflow.graph.edges.entries()) {
    const edgePath = [...pathPrefix, 'graph', 'edges', edgeIndex];

    if (edgeIds.has(edge.id)) {
      addCustomIssue(
        context,
        [...edgePath, 'id'],
        'Edge IDs must be unique within a workflow'
      );
    }
    edgeIds.add(edge.id);

    if (!stateIdSet.has(edge.from)) {
      addCustomIssue(
        context,
        [...edgePath, 'from'],
        `Unknown source state "${edge.from}"`
      );
    }
    if (!stateIdSet.has(edge.to)) {
      addCustomIssue(
        context,
        [...edgePath, 'to'],
        `Unknown destination state "${edge.to}"`
      );
    }

    const pair = `${edge.from}→${edge.to}`;
    if (directedPairs.has(pair)) {
      addCustomIssue(context, edgePath, `Duplicate directed edge ${pair}`);
    }
    directedPairs.add(pair);
  }
}

function validateWorkflowPresets(
  workflow: WorkflowDocumentValue,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[]
): void {
  const presetIds = new Set(
    workflow.resolutionPresets.map((preset) => preset.id)
  );
  if (presetIds.size !== workflow.resolutionPresets.length) {
    addCustomIssue(
      context,
      [...pathPrefix, 'resolutionPresets'],
      'Resolution preset IDs must be unique'
    );
  }

  for (const [edgeIndex, edge] of workflow.graph.edges.entries()) {
    if (edge.resolutionPresetId && !presetIds.has(edge.resolutionPresetId)) {
      addCustomIssue(
        context,
        [...pathPrefix, 'graph', 'edges', edgeIndex, 'resolutionPresetId'],
        `Unknown resolution preset "${edge.resolutionPresetId}"`
      );
    }
  }
}

function buildOutboundByState(
  edges: WorkflowDocumentValue['graph']['edges']
): Map<string, WorkflowEdgeValue[]> {
  const outboundByState = new Map<string, WorkflowEdgeValue[]>();
  for (const edge of edges) {
    const list = outboundByState.get(edge.from) ?? [];
    list.push(edge);
    outboundByState.set(edge.from, list);
  }
  return outboundByState;
}

function validateWorkflowStateFlags(
  workflow: WorkflowDocumentValue,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[]
): void {
  const outboundByState = buildOutboundByState(workflow.graph.edges);
  const edgeIndexById = new Map(
    workflow.graph.edges.map((edge, index) => [edge.id, index])
  );

  for (const [stateIndex, state] of workflow.graph.states.entries()) {
    const outbound = outboundByState.get(state.id) ?? [];
    if (state.terminal && outbound.length > 0) {
      addCustomIssue(
        context,
        [...pathPrefix, 'graph', 'states', stateIndex, 'terminal'],
        'Terminal states cannot have outbound edges — remove them before locking'
      );
    }
    if (!state.requiresEscalation) {
      continue;
    }
    for (const edge of outbound) {
      if (edge.resolutionPresetId) {
        continue;
      }
      addCustomIssue(
        context,
        [
          ...pathPrefix,
          'graph',
          'edges',
          edgeIndexById.get(edge.id) ?? 0,
          'resolutionPresetId',
        ],
        `State "${state.id}" requires escalation — outbound edge must reference a resolution preset`
      );
    }
  }
}

function validateWorkflowDocument(
  workflow: WorkflowDocumentValue,
  context: z.RefinementCtx,
  pathPrefix: (string | number)[]
): void {
  const stateIdSet = validateUniqueStateIds(workflow, context, pathPrefix);
  validateWorkflowEdges(workflow, stateIdSet, context, pathPrefix);
  validateWorkflowPresets(workflow, context, pathPrefix);
  validateWorkflowStateFlags(workflow, context, pathPrefix);
}

function validateEnvelopeWorkflowIds(
  envelope: {
    readonly defaultWorkflowId: string;
    readonly workflows: readonly WorkflowDocumentValue[];
  },
  context: z.RefinementCtx
): Map<string, WorkflowDocumentValue> {
  const ids = envelope.workflows.map((workflow) => workflow.id);
  if (new Set(ids).size !== ids.length) {
    addCustomIssue(context, ['workflows'], 'Workflow IDs must be unique');
  }
  if (!ids.includes(envelope.defaultWorkflowId)) {
    addCustomIssue(
      context,
      ['defaultWorkflowId'],
      'defaultWorkflowId must reference a workflow in the envelope'
    );
  }
  return new Map(envelope.workflows.map((workflow) => [workflow.id, workflow]));
}

function validateForkParents(
  workflows: readonly WorkflowDocumentValue[],
  byId: Map<string, WorkflowDocumentValue>,
  context: z.RefinementCtx
): void {
  for (const [index, workflow] of workflows.entries()) {
    validateWorkflowDocument(workflow, context, ['workflows', index]);
    if (!workflow.forkedFromId) {
      continue;
    }
    const parent = byId.get(workflow.forkedFromId);
    if (!parent) {
      addCustomIssue(
        context,
        ['workflows', index, 'forkedFromId'],
        `Unknown fork parent "${workflow.forkedFromId}"`
      );
      continue;
    }
    if (parent.forkedFromId) {
      addCustomIssue(
        context,
        ['workflows', index, 'forkedFromId'],
        'Fork depth cannot exceed 1 (cannot fork a fork)'
      );
    }
  }
}

function validateDisjointTypeBindings(
  workflows: readonly WorkflowDocumentValue[],
  context: z.RefinementCtx
): void {
  const claimedTypes = new Map<WorkItemType, string>();
  for (const [index, workflow] of workflows.entries()) {
    for (const [bindingIndex, type] of workflow.typeBindings.entries()) {
      const owner = claimedTypes.get(type);
      if (owner && owner !== workflow.id) {
        addCustomIssue(
          context,
          ['workflows', index, 'typeBindings', bindingIndex],
          `Work item type "${type}" is already bound to workflow "${owner}"`
        );
      } else {
        claimedTypes.set(type, workflow.id);
      }
    }
  }
}

export const workflowConfigEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(WORKFLOW_CONFIG_SCHEMA_VERSION),
    defaultWorkflowId: z.string().trim().min(1),
    workflows: z
      .array(workflowDocumentSchema)
      .min(1, 'At least one workflow is required'),
  })
  .passthrough()
  .superRefine((envelope, context) => {
    const byId = validateEnvelopeWorkflowIds(envelope, context);
    validateForkParents(envelope.workflows, byId, context);
    validateDisjointTypeBindings(envelope.workflows, context);
  });

export type WorkflowResolutionPreset = z.infer<
  typeof workflowResolutionPresetSchema
>;
export type WorkflowStateNode = z.infer<typeof workflowStateNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowDocument = z.infer<typeof workflowDocumentSchema>;
export type WorkflowConfigEnvelope = z.infer<
  typeof workflowConfigEnvelopeSchema
>;

function formatStatusLabel(status: WorkItemStatus): string {
  return status.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
}

function seededDefaultStates(): WorkflowStateNode[] {
  return BOARD_WORK_ITEM_STATUSES.map((status) => ({
    id: status,
    name: formatStatusLabel(status),
    category: categoryFromWorkItemStatus(status),
    lockRecord: status === WorkItemStatusEnum.Done,
    terminal: false,
    requiresEscalation: false,
  }));
}

function seededDefaultEdges(): WorkflowEdge[] {
  const chain: WorkItemStatus[] = [
    WorkItemStatusEnum.New,
    WorkItemStatusEnum.ToDo,
    WorkItemStatusEnum.InProgress,
    WorkItemStatusEnum.Testing,
    WorkItemStatusEnum.Done,
  ];

  const forward: WorkflowEdge[] = [];
  for (let index = 0; index < chain.length - 1; index += 1) {
    const from = chain[index]!;
    const to = chain[index + 1]!;
    forward.push({
      id: `e-${from}-to-${to}`,
      from,
      to,
      allowAnyOf: [],
      resolutionPresetId: null,
      requireChildren: to === WorkItemStatusEnum.Done ? 'all_complete' : 'off',
    });
  }

  // Explicit reverse for Dev ↔ QA style cycles (Testing → InProgress).
  forward.push({
    id: 'e-Testing-to-InProgress',
    from: WorkItemStatusEnum.Testing,
    to: WorkItemStatusEnum.InProgress,
    allowAnyOf: [],
    resolutionPresetId: null,
    requireChildren: 'off',
  });

  return forward;
}

/** Canonical seeded envelope used when config is null/invalid. */
export function createSeededDefaultWorkflowConfig(): WorkflowConfigEnvelope {
  return workflowConfigEnvelopeSchema.parse({
    schemaVersion: WORKFLOW_CONFIG_SCHEMA_VERSION,
    defaultWorkflowId: DEFAULT_WORKFLOW_ID,
    workflows: [
      {
        id: DEFAULT_WORKFLOW_ID,
        title: 'Default',
        description: 'Seeded default workflow',
        forkedFromId: null,
        typeBindings: [
          WorkItemTypeEnum.Epic,
          WorkItemTypeEnum.Story,
          WorkItemTypeEnum.Task,
          WorkItemTypeEnum.Issue,
        ],
        graph: {
          states: seededDefaultStates(),
          edges: seededDefaultEdges(),
        },
        layout: { nodes: {}, edges: {} },
        resolutionPresets: [],
      },
    ],
  });
}

/** @deprecated Prefer createSeededDefaultWorkflowConfig — alias for clarity. */
export const seededDefaultWorkflowConfig = createSeededDefaultWorkflowConfig;

export function parseWorkflowConfigEnvelope(
  value: unknown
): WorkflowConfigEnvelope | null {
  const parsed = workflowConfigEnvelopeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Never throws for read paths: null / board-only / invalid JSON → seeded default.
 */
export function resolveWorkflowConfig(value: unknown): {
  readonly config: WorkflowConfigEnvelope;
  readonly usedFallback: boolean;
} {
  const parsed = parseWorkflowConfigEnvelope(value);
  if (parsed) {
    return { config: parsed, usedFallback: false };
  }
  return {
    config: createSeededDefaultWorkflowConfig(),
    usedFallback: true,
  };
}

/**
 * Overlay envelope keys onto an existing project `workflow_config` blob so
 * `work_item_types` / hierarchy / legacy board fields survive until Step 9.
 */
export function mergeWorkflowEnvelopeIntoProjectConfig(
  current: unknown,
  envelope: WorkflowConfigEnvelope
): Record<string, unknown> {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  return {
    ...base,
    schemaVersion: envelope.schemaVersion,
    defaultWorkflowId: envelope.defaultWorkflowId,
    workflows: envelope.workflows,
  };
}

export function findWorkflowById(
  config: WorkflowConfigEnvelope,
  workflowId: string
): WorkflowDocument | null {
  return (
    config.workflows.find((workflow) => workflow.id === workflowId) ?? null
  );
}

export function resolveWorkflowForWorkItemType(
  config: WorkflowConfigEnvelope,
  type: WorkItemType
): WorkflowDocument {
  const bound = config.workflows.find((workflow) =>
    workflow.typeBindings.includes(type)
  );
  if (bound) {
    return bound;
  }
  return (
    findWorkflowById(config, config.defaultWorkflowId) ?? config.workflows[0]!
  );
}
