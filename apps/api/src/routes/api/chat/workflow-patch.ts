import { z } from 'zod';
import {
  findWorkflowById,
  workflowConfigEnvelopeSchema,
  type WorkflowConfigEnvelope,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowStateNode,
} from '@repo/types/api/v1';

export const proposeWorkflowPatchInputSchema = z.object({
  projectId: z.uuid(),
  summary: z.string().trim().min(1).max(500),
  /** Complete next workflow envelope after the requested edits. */
  config: workflowConfigEnvelopeSchema,
});

export type ProposeWorkflowPatchInput = z.infer<
  typeof proposeWorkflowPatchInputSchema
>;

function workflowTitle(doc: WorkflowDocument): string {
  return doc.title || doc.id;
}

function diffWorkflowMembership(
  before: WorkflowConfigEnvelope,
  after: WorkflowConfigEnvelope
): string[] {
  const lines: string[] = [];
  const beforeIds = new Set(before.workflows.map((w) => w.id));
  const afterIds = new Set(after.workflows.map((w) => w.id));

  for (const id of afterIds) {
    if (beforeIds.has(id)) continue;
    const doc = findWorkflowById(after, id);
    lines.push(`Added workflow “${doc ? workflowTitle(doc) : id}”.`);
  }
  for (const id of beforeIds) {
    if (afterIds.has(id)) continue;
    const doc = findWorkflowById(before, id);
    lines.push(`Removed workflow “${doc ? workflowTitle(doc) : id}”.`);
  }
  return lines;
}

function diffStateFlags(
  beforeState: WorkflowStateNode,
  afterState: WorkflowStateNode,
  label: string
): string[] {
  const lines: string[] = [];
  if (beforeState.name !== afterState.name) {
    lines.push(
      `Renamed state “${beforeState.name}” → “${afterState.name}” in ${label}.`
    );
  }
  if (beforeState.category !== afterState.category) {
    lines.push(
      `Changed category of “${afterState.name}” to ${afterState.category} in ${label}.`
    );
  }
  if (beforeState.lockRecord !== afterState.lockRecord) {
    lines.push(
      `${afterState.lockRecord ? 'Enabled' : 'Disabled'} lock record on “${afterState.name}” in ${label}.`
    );
  }
  if (beforeState.terminal !== afterState.terminal) {
    lines.push(
      `${afterState.terminal ? 'Marked' : 'Unmarked'} “${afterState.name}” as terminal in ${label}.`
    );
  }
  return lines;
}

function diffStates(
  before: WorkflowDocument,
  after: WorkflowDocument,
  label: string
): string[] {
  const lines: string[] = [];
  const beforeStates = new Map(before.graph.states.map((s) => [s.id, s]));
  const afterStates = new Map(after.graph.states.map((s) => [s.id, s]));

  for (const [id, state] of afterStates) {
    if (!beforeStates.has(id)) {
      lines.push(`Added state “${state.name}” in ${label}.`);
    }
  }
  for (const [id, state] of beforeStates) {
    if (!afterStates.has(id)) {
      lines.push(`Removed state “${state.name}” from ${label}.`);
    }
  }
  for (const [id, afterState] of afterStates) {
    const beforeState = beforeStates.get(id);
    if (!beforeState) continue;
    lines.push(...diffStateFlags(beforeState, afterState, label));
  }
  return lines;
}

function edgeLabel(edge: WorkflowEdge): string {
  return `${edge.from} → ${edge.to}`;
}

function diffEdges(
  before: WorkflowDocument,
  after: WorkflowDocument,
  label: string
): string[] {
  const lines: string[] = [];
  const beforeEdges = new Map(before.graph.edges.map((e) => [e.id, e]));
  const afterEdges = new Map(after.graph.edges.map((e) => [e.id, e]));

  for (const [id, edge] of afterEdges) {
    if (!beforeEdges.has(id)) {
      lines.push(`Added transition ${edgeLabel(edge)} in ${label}.`);
    }
  }
  for (const [id, edge] of beforeEdges) {
    if (!afterEdges.has(id)) {
      lines.push(`Removed transition ${edgeLabel(edge)} from ${label}.`);
    }
  }
  return lines;
}

function diffSingleWorkflow(
  before: WorkflowDocument,
  after: WorkflowDocument
): string[] {
  const label = workflowTitle(after);
  const lines: string[] = [];

  if (before.title !== after.title) {
    lines.push(`Renamed workflow to “${after.title}”.`);
  }
  lines.push(
    ...diffStates(before, after, label),
    ...diffEdges(before, after, label)
  );

  if (before.resolutionPresets.length !== after.resolutionPresets.length) {
    lines.push(
      `Resolution presets: ${before.resolutionPresets.length} → ${after.resolutionPresets.length} in ${label}.`
    );
  }

  return lines;
}

/** Build short human-readable change lines vs a baseline envelope. */
export function summarizeWorkflowEnvelopeDiff(
  before: WorkflowConfigEnvelope,
  after: WorkflowConfigEnvelope
): string[] {
  const lines: string[] = [];

  if (before.defaultWorkflowId !== after.defaultWorkflowId) {
    lines.push(`Default workflow changed to ${after.defaultWorkflowId}.`);
  }

  lines.push(...diffWorkflowMembership(before, after));

  for (const afterDoc of after.workflows) {
    const beforeDoc = findWorkflowById(before, afterDoc.id);
    if (!beforeDoc) continue;
    lines.push(...diffSingleWorkflow(beforeDoc, afterDoc));
  }

  if (lines.length === 0) {
    lines.push(
      'Proposed workflow matches the current draft (no structural diff).'
    );
  }
  return lines.slice(0, 12);
}

export function parseProposeWorkflowPatchInput(
  rawInput: unknown
): ProposeWorkflowPatchInput {
  const parsed = proposeWorkflowPatchInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Invalid propose_workflow_patch input. Supply the complete WorkflowConfigEnvelope from get_workflow_config with your edits applied. ${details}`
    );
  }
  return parsed.data;
}

export const dismissWorkflowProposalInputSchema = z.object({
  projectId: z.uuid(),
  reason: z.string().trim().max(500).optional(),
});

export type DismissWorkflowProposalInput = z.infer<
  typeof dismissWorkflowProposalInputSchema
>;

export function parseDismissWorkflowProposalInput(
  rawInput: unknown
): DismissWorkflowProposalInput {
  const parsed = dismissWorkflowProposalInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `Invalid dismiss_workflow_proposal input: ${parsed.error.issues[0]?.message ?? 'validation failed'}`
    );
  }
  return parsed.data;
}
