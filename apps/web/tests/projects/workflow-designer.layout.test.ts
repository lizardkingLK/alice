import { describe, expect, it } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import {
  applyNodePositionsToDocument,
  defaultStatePosition,
  makeStateTerminalInDocument,
  patchEdgeInDocument,
  patchStateInDocument,
  readLayoutPosition,
  replaceWorkflowInEnvelope,
  workflowDocumentToFlowElements,
} from '@/app/projects/_helpers/workflow-designer.layout';

describe('workflow-designer.layout', () => {
  it('defaults node positions when layout is empty', () => {
    // Arrange
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = envelope.workflows[0]!;

    // Act
    const { nodes, edges } = workflowDocumentToFlowElements(workflow);

    // Assert
    expect(nodes).toHaveLength(workflow.graph.states.length);
    expect(edges).toHaveLength(workflow.graph.edges.length);
    expect(nodes[0]?.position).toEqual(defaultStatePosition(0));
    expect(nodes[1]?.position).toEqual(defaultStatePosition(1));
    expect(edges[0]?.source).toBe(workflow.graph.edges[0]?.from);
    expect(edges[0]?.target).toBe(workflow.graph.edges[0]?.to);
    expect(edges[0]?.markerEnd).toEqual({
      type: 'arrowclosed',
      width: 16,
      height: 16,
    });
  });

  it('reads persisted layout coordinates for a state', () => {
    // Arrange
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = {
      ...envelope.workflows[0]!,
      layout: {
        nodes: { New: { x: 40, y: 120 } },
        edges: {},
      },
    };

    // Act
    const position = readLayoutPosition(workflow.layout, 'New', 0);

    // Assert
    expect(position).toEqual({ x: 40, y: 120 });
  });

  it('applies dragged positions into layout.nodes without changing graph edges', () => {
    // Arrange
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = envelope.workflows[0]!;
    const edgeCount = workflow.graph.edges.length;

    // Act
    const next = applyNodePositionsToDocument(workflow, [
      { id: 'New', position: { x: 10, y: 20 } },
      { id: 'ToDo', position: { x: 30, y: 40 } },
    ]);
    const replaced = replaceWorkflowInEnvelope(envelope, next);

    // Assert
    expect(next.graph.edges).toHaveLength(edgeCount);
    expect(next.layout.nodes.New).toEqual({ x: 10, y: 20 });
    expect(next.layout.nodes.ToDo).toEqual({ x: 30, y: 40 });
    expect(replaced.workflows[0]?.layout.nodes.New).toEqual({ x: 10, y: 20 });
  });

  it('patches state name and category in the document graph', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const next = patchStateInDocument(workflow, WorkItemStatusEnum.ToDo, {
      name: 'Ready',
      category: 'in_progress',
    });
    const patched = next.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.ToDo
    );
    expect(patched?.name).toBe('Ready');
    expect(patched?.category).toBe('in_progress');
  });

  it('patches edge requireChildren and allowAnyOf', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const edgeId = workflow.graph.edges[0]!.id;
    const next = patchEdgeInDocument(workflow, edgeId, {
      requireChildren: 'match_parent_target',
      allowAnyOf: [{ scope: 'role', role: 'manager' }],
    });
    const patched = next.graph.edges.find((edge) => edge.id === edgeId);
    expect(patched?.requireChildren).toBe('match_parent_target');
    expect(patched?.allowAnyOf).toEqual([{ scope: 'role', role: 'manager' }]);
  });

  it('makes a state terminal by removing outbound edges', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const beforeOutbound = workflow.graph.edges.filter(
      (edge) => edge.from === WorkItemStatusEnum.New
    ).length;
    expect(beforeOutbound).toBeGreaterThan(0);

    const next = makeStateTerminalInDocument(workflow, WorkItemStatusEnum.New);
    const state = next.graph.states.find(
      (candidate) => candidate.id === WorkItemStatusEnum.New
    );
    expect(state?.terminal).toBe(true);
    expect(
      next.graph.edges.filter((edge) => edge.from === WorkItemStatusEnum.New)
    ).toHaveLength(0);
  });
});
