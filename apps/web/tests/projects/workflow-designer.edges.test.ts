import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_EDGE_STROKE,
  WORKFLOW_HANDLE,
  assignWorkflowEdgeAnchors,
  resolveReturnEdgeAnchor,
  resolveWorkflowEdgeAnchor,
} from '@/app/projects/_helpers/workflow-designer.edges';

describe('workflow-designer.edges', () => {
  it('anchors right-to-left for left-to-right node pairs', () => {
    // Arrange / Act
    const anchor = resolveWorkflowEdgeAnchor({ x: 0, y: 0 }, { x: 240, y: 10 });

    // Assert
    expect(anchor).toEqual({
      sourceHandle: WORKFLOW_HANDLE.sourceRight,
      targetHandle: WORKFLOW_HANDLE.targetLeft,
      direction: 'forward',
    });
  });

  it('anchors left-to-right and marks reverse when target is left of source', () => {
    // Arrange / Act
    const anchor = resolveWorkflowEdgeAnchor({ x: 240, y: 0 }, { x: 0, y: 10 });

    // Assert
    expect(anchor).toEqual({
      sourceHandle: WORKFLOW_HANDLE.sourceLeft,
      targetHandle: WORKFLOW_HANDLE.targetRight,
      direction: 'reverse',
    });
  });

  it('anchors top/bottom when the vertical distance dominates', () => {
    // Arrange / Act
    const down = resolveWorkflowEdgeAnchor({ x: 0, y: 0 }, { x: 20, y: 200 });
    const up = resolveWorkflowEdgeAnchor({ x: 0, y: 200 }, { x: 20, y: 0 });

    // Assert
    expect(down).toEqual({
      sourceHandle: WORKFLOW_HANDLE.sourceBottom,
      targetHandle: WORKFLOW_HANDLE.targetTop,
      direction: 'forward',
    });
    expect(up).toEqual({
      sourceHandle: WORKFLOW_HANDLE.sourceTop,
      targetHandle: WORKFLOW_HANDLE.targetBottom,
      direction: 'forward',
    });
  });

  it('routes return edges on remaining top/bottom ports', () => {
    // Arrange / Act
    const above = resolveReturnEdgeAnchor({ x: 240, y: 40 }, { x: 0, y: 0 });
    const below = resolveReturnEdgeAnchor({ x: 240, y: 0 }, { x: 0, y: 40 });

    // Assert
    expect(above).toEqual({
      sourceHandle: WORKFLOW_HANDLE.sourceBottom,
      targetHandle: WORKFLOW_HANDLE.targetBottom,
      direction: 'reverse',
    });
    expect(below).toEqual({
      sourceHandle: WORKFLOW_HANDLE.sourceTop,
      targetHandle: WORKFLOW_HANDLE.targetTop,
      direction: 'reverse',
    });
  });

  it('uses return ports for the reverse half of a bidirectional pair', () => {
    // Arrange
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 240, y: 0 } },
    ];
    const edges = [
      { id: 'fwd', source: 'a', target: 'b' },
      { id: 'rev', source: 'b', target: 'a' },
    ];

    // Act
    const anchors = assignWorkflowEdgeAnchors(nodes, edges);

    // Assert
    expect(anchors.get('fwd')).toMatchObject({
      sourceHandle: WORKFLOW_HANDLE.sourceRight,
      targetHandle: WORKFLOW_HANDLE.targetLeft,
      direction: 'forward',
    });
    expect(anchors.get('rev')).toMatchObject({
      sourceHandle: WORKFLOW_HANDLE.sourceBottom,
      targetHandle: WORKFLOW_HANDLE.targetBottom,
      direction: 'reverse',
    });
    expect(WORKFLOW_EDGE_STROKE.forward).toBe('var(--primary)');
    expect(WORKFLOW_EDGE_STROKE.reverse).toBe('var(--foreground)');
  });

  it('honors persisted connect handles over smart routing', () => {
    // Arrange
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 240, y: 40 } },
    ];
    const edges = [{ id: 'e1', source: 'a', target: 'b' }];

    // Act
    const anchors = assignWorkflowEdgeAnchors(nodes, edges, {
      preferredHandles: new Map([
        [
          'e1',
          {
            sourceHandle: WORKFLOW_HANDLE.sourceTop,
            targetHandle: WORKFLOW_HANDLE.targetRight,
          },
        ],
      ]),
    });

    // Assert
    expect(anchors.get('e1')).toMatchObject({
      sourceHandle: WORKFLOW_HANDLE.sourceTop,
      targetHandle: WORKFLOW_HANDLE.targetRight,
      direction: 'forward',
    });
  });

  it('staggers path offsets for edges that share the same route corridor', () => {
    // Arrange
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 240, y: 0 } },
      { id: 'c', position: { x: 240, y: 80 } },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'c' },
    ];

    // Act
    const anchors = assignWorkflowEdgeAnchors(nodes, edges);

    // Assert
    expect(anchors.get('e1')?.pathOffset).toBe(18);
    expect(anchors.get('e2')?.pathOffset).toBe(32);
  });
});
