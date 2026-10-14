import { describe, expect, it } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import {
  addEdgeToDocument,
  addStateToDocument,
  applyNodePositionsToDocument,
  canConnectWorkflowStates,
  captureSelectedStateClipboard,
  captureStateClipboard,
  defaultStatePosition,
  makeStateTerminalInDocument,
  pasteStateFromClipboard,
  patchEdgeInDocument,
  patchStateInDocument,
  readLayoutPosition,
  readLayoutEdgeHandles,
  removeEdgeFromDocument,
  removeStateFromDocument,
  renameWorkflowInEnvelope,
  replaceWorkflowInEnvelope,
  updateEdgeHandlesInDocument,
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
    expect(edges[0]?.type).toBe('workflowTransition');
    expect(edges[0]?.sourceHandle).toBe('source-right');
    expect(edges[0]?.targetHandle).toBe('target-left');
    expect(edges[0]?.data).toEqual({
      direction: 'forward',
      pathOffset: 18,
    });
    expect(edges[0]?.markerEnd).toEqual({
      type: 'arrowclosed',
      width: 20,
      height: 20,
      color: 'var(--primary)',
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

  it('updates layout handles on reconnect without changing graph edges', () => {
    // Arrange
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const edge = workflow.graph.edges[0]!;
    const edgeCount = workflow.graph.edges.length;
    const requireChildren = edge.requireChildren;

    // Act
    const result = updateEdgeHandlesInDocument(workflow, edge.id, {
      sourceHandle: 'source-bottom',
      targetHandle: 'target-left',
    });

    // Assert
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document.graph.edges).toHaveLength(edgeCount);
    expect(
      result.document.graph.edges.find((item) => item.id === edge.id)
        ?.requireChildren
    ).toBe(requireChildren);
    expect(readLayoutEdgeHandles(result.document.layout, edge.id)).toEqual({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-left',
    });
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

  it('adds a unique state id with default todo flags and layout', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const first = addStateToDocument(workflow);
    const second = addStateToDocument(first.document);

    expect(first.stateId).toMatch(/^st-/);
    expect(second.stateId).not.toBe(first.stateId);
    const created = second.document.graph.states.find(
      (state) => state.id === second.stateId
    );
    expect(created).toMatchObject({
      name: 'New state',
      category: 'todo',
      lockRecord: false,
      terminal: false,
      requiresEscalation: false,
    });
    expect(second.document.layout.nodes[second.stateId]).toEqual(
      defaultStatePosition(workflow.graph.states.length + 1)
    );
  });

  it('rejects self-loops and duplicate directed edges', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    expect(
      canConnectWorkflowStates(
        workflow,
        WorkItemStatusEnum.New,
        WorkItemStatusEnum.New
      )
    ).toEqual({ ok: false, reason: 'Self-loop edges are not allowed.' });
    expect(
      canConnectWorkflowStates(
        workflow,
        WorkItemStatusEnum.New,
        WorkItemStatusEnum.ToDo
      )
    ).toEqual({ ok: false, reason: 'That transition already exists.' });
  });

  it('adds an edge with open defaults when the pair is allowed', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const result = addEdgeToDocument(
      workflow,
      WorkItemStatusEnum.Done,
      WorkItemStatusEnum.New
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const edge = result.document.graph.edges.find(
      (candidate) => candidate.id === result.edgeId
    );
    expect(edge).toMatchObject({
      from: WorkItemStatusEnum.Done,
      to: WorkItemStatusEnum.New,
      allowAnyOf: [],
      requiresEscalation: false,
      resolutionPresetId: null,
      requireChildren: 'off',
    });
  });

  it('removes a state and its incident edges', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const removed = removeStateFromDocument(
      workflow,
      WorkItemStatusEnum.Testing
    );
    expect(removed.ok).toBe(true);
    if (!removed.ok) {
      return;
    }
    expect(
      removed.document.graph.states.some(
        (state) => state.id === WorkItemStatusEnum.Testing
      )
    ).toBe(false);
    expect(
      removed.document.graph.edges.some(
        (edge) =>
          edge.from === WorkItemStatusEnum.Testing ||
          edge.to === WorkItemStatusEnum.Testing
      )
    ).toBe(false);
  });

  it('removes a single edge by id', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const edgeId = workflow.graph.edges[0]!.id;
    const next = removeEdgeFromDocument(workflow, edgeId);
    expect(next.graph.edges.some((edge) => edge.id === edgeId)).toBe(false);
  });

  it('renames a workflow title in the envelope', () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const next = renameWorkflowInEnvelope(
      envelope,
      envelope.defaultWorkflowId,
      'Delivery'
    );
    expect(next.workflows[0]?.title).toBe('Delivery');
  });

  it('pastes a cut state with a new id and no edges', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const clipboard = captureStateClipboard(
      workflow,
      WorkItemStatusEnum.Testing
    );
    expect(clipboard).not.toBeNull();
    const pasted = pasteStateFromClipboard(workflow, clipboard!);
    expect(pasted.stateId).toMatch(/^st-/);
    expect(pasted.stateId).not.toBe(WorkItemStatusEnum.Testing);
    const state = pasted.document.graph.states.find(
      (candidate) => candidate.id === pasted.stateId
    );
    expect(state?.name).toBe(
      workflow.graph.states.find((s) => s.id === WorkItemStatusEnum.Testing)
        ?.name
    );
    expect(
      pasted.document.graph.edges.some(
        (edge) => edge.from === pasted.stateId || edge.to === pasted.stateId
      )
    ).toBe(false);
  });

  it('captureSelectedStateClipboard only returns for state selections', () => {
    // Arrange
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;

    // Act / Assert
    expect(
      captureSelectedStateClipboard(workflow, {
        kind: 'state',
        stateId: WorkItemStatusEnum.Testing,
      })
    ).toEqual({
      stateId: WorkItemStatusEnum.Testing,
      clipboard: captureStateClipboard(workflow, WorkItemStatusEnum.Testing),
    });
    expect(
      captureSelectedStateClipboard(workflow, {
        kind: 'edge',
        stateId: WorkItemStatusEnum.Testing,
      })
    ).toBeNull();
    expect(captureSelectedStateClipboard(workflow, null)).toBeNull();
  });
});
