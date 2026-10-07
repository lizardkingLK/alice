import { describe, expect, it } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import {
  applyNodePositionsToDocument,
  defaultStatePosition,
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
});
