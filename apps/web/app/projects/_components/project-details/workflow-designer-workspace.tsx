'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  findWorkflowById,
  isWorkflowOrphanedStatesConflict,
  resolveWorkflowConfig,
  upsertResolutionPreset,
  WORKFLOW_ORPHANED_STATES_CODE,
  type ChatWorkflowViewContext,
  type WorkflowConfigEnvelope,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowOrphanedStatesConflict,
  type WorkflowResolutionPreset,
  type WorkflowStateNode,
  type WorkflowStateRemap,
} from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@repo/ui/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  FlowCanvas,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@repo/ui/components/ui/flow-canvas';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { toast } from '@repo/ui/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  CircleHelp,
  Download,
  GitBranch,
  GitFork,
  Kanban,
  Lock,
  RotateCcw,
  Save,
  Star,
  Trash2,
} from '@repo/ui/lib/icons';
import { FormAlertMessage } from '@/components/form-alert-message';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import {
  deleteProjectWorkflow,
  forkProjectWorkflow,
  importProjectWorkflow,
  putProjectWorkflowConfig,
  setDefaultProjectWorkflow,
} from '@/app/projects/_services/projects.workflow-config.client';
import {
  WorkflowImportDialog,
  type WorkflowImportSubmitInput,
} from '@/app/projects/_components/project-details/workflow-import-dialog';
import { WorkflowOrphanedStatesDialog } from '@/app/projects/_components/project-details/workflow-orphaned-states-dialog';
import { WorkflowStateFlowNode } from '@/app/projects/_components/project-details/workflow-state-flow-node';
import { WorkflowTransitionEdge } from '@/app/projects/_components/project-details/workflow-transition-edge';
import {
  WorkflowDesignerSettings,
  type WorkflowDesignerSelection,
} from '@/app/projects/_components/project-details/workflow-designer-settings';
import { WorkflowDesignerContextMenuContent } from '@/app/projects/_components/project-details/workflow-designer-context-menu';
import { WorkflowDesignerHelp } from '@/app/projects/_components/project-details/workflow-designer-help';
import type { TransitionRuleTeamOption } from '@/app/projects/_components/project-details/transition-rule-permissions';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import { assignWorkflowEdgeAnchors } from '@/app/projects/_helpers/workflow-designer.edges';
import {
  WORKFLOW_STATE_NODE_TYPE,
  WORKFLOW_TRANSITION_EDGE_TYPE,
  addEdgeToDocument,
  addStateToDocument,
  applyNodePositionsToDocument,
  canConnectWorkflowStates,
  captureSelectedStateClipboard,
  cloneWorkflowEnvelope,
  collectLayoutEdgeHandles,
  envelopesEqualForDesigner,
  makeStateTerminalInDocument,
  pasteStateFromClipboard,
  patchEdgeInDocument,
  patchStateInDocument,
  removeEdgeFromDocument,
  removeStateFromDocument,
  renameWorkflowInEnvelope,
  replaceWorkflowInEnvelope,
  updateEdgeHandlesInDocument,
  workflowDocumentToFlowElements,
  workflowFlowEdgePresentation,
  type WorkflowStateClipboard,
} from '@/app/projects/_helpers/workflow-designer.layout';
import {
  clearWorkflowUndo,
  createWorkflowUndoStack,
  popWorkflowUndo,
  pushWorkflowUndo,
} from '@/app/projects/_helpers/workflow-designer.undo';
import { handleWorkflowDesignerKeydown } from '@/app/projects/_helpers/workflow-designer-shortcuts';
import { persistWorkflowDesignerSettingsOpen } from '@/app/projects/_helpers/workflow-designer-settings-storage';
import { useRegisterWorkflowAliceBridge } from '@/app/projects/_components/project-details/workflow-alice-bridge';

type WorkflowDesignerWorkspaceProps = {
  readonly project: Project;
  readonly canEdit: boolean;
  readonly currentUserId?: string | null;
  readonly teams?: readonly TransitionRuleTeamOption[];
  readonly members?: readonly MemberCheckboxOption[];
  /** SSR cookie seed for Settings panel — expanded by default. */
  readonly initialSettingsOpen?: boolean;
};

const nodeTypes = {
  [WORKFLOW_STATE_NODE_TYPE]: WorkflowStateFlowNode,
};

const edgeTypes = {
  [WORKFLOW_TRANSITION_EDGE_TYPE]: WorkflowTransitionEdge,
};

/** Success banner + toast auto-clear (ms). */
const SUCCESS_FEEDBACK_MS = 6000;

function resolveInitialEnvelope(workflowConfig: Project['workflow_config']): {
  readonly envelope: WorkflowConfigEnvelope;
  readonly usedFallback: boolean;
} {
  const resolved = resolveWorkflowConfig(workflowConfig);
  return {
    envelope: cloneWorkflowEnvelope(resolved.config),
    usedFallback: resolved.usedFallback,
  };
}

// eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
type WorkflowNodesSettledHandler = (settledNodes: Node[]) => void;
// eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
type WorkflowSelectionHandler = (selection: WorkflowDesignerSelection) => void;
// eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
type WorkflowConnectHandler = (connection: Connection) => void;
/* eslint-disable no-unused-vars -- callback parameter names document the payload */
type WorkflowReconnectHandler = (edge: Edge, connection: Connection) => void;
/* eslint-enable no-unused-vars */

type WorkflowManageResult = {
  readonly config: WorkflowConfigEnvelope;
  readonly updatedAt: string;
  readonly forkedWorkflowId?: string;
  readonly importedWorkflowId?: string;
};

/* eslint-disable no-unused-vars -- callback parameter names document the payload */
type WorkflowManageAction = (
  expectedUpdatedAt: string
) => Promise<WorkflowManageResult>;
type WorkflowManageNextId =
  string | ((result: WorkflowManageResult) => string | undefined);
/* eslint-enable no-unused-vars */

function openSelectionInSettings(
  event: { preventDefault: () => void; stopPropagation: () => void },
  selection: NonNullable<WorkflowDesignerSelection>,
  onSelectionChange: WorkflowSelectionHandler,
  onOpenSettings: () => void
): void {
  // Dblclick otherwise selects text in the Settings panel as it opens/updates.
  event.preventDefault();
  event.stopPropagation();
  onSelectionChange(selection);
  onOpenSettings();
  requestAnimationFrame(() => {
    window.getSelection()?.removeAllRanges();
  });
}

function WorkflowDesignerCanvas({
  activeWorkflow,
  canEdit,
  selection,
  onNodesSettled,
  onSelectionChange,
  onOpenSettings,
  onConnect,
  onReconnect,
}: {
  readonly activeWorkflow: WorkflowDocument;
  readonly canEdit: boolean;
  /** Settings-panel selection — also drives marching-ants visuals on the canvas. */
  readonly selection: WorkflowDesignerSelection;
  readonly onNodesSettled: WorkflowNodesSettledHandler;
  readonly onSelectionChange: WorkflowSelectionHandler;
  readonly onOpenSettings: () => void;
  readonly onConnect: WorkflowConnectHandler;
  readonly onReconnect: WorkflowReconnectHandler;
}) {
  const initial = workflowDocumentToFlowElements(activeWorkflow);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges as Edge[]);

  // Overlay document fields so Settings name/category updates live without remount.
  // App selection is the source of truth for marching-ants highlight.
  const nodesForCanvas = useMemo(() => {
    const byId = new Map(
      activeWorkflow.graph.states.map((state) => [state.id, state])
    );
    return nodes.map((node) => {
      const state = byId.get(node.id);
      return {
        ...node,
        selected: selection?.kind === 'state' && selection.stateId === node.id,
        data: state
          ? {
              ...node.data,
              label: state.name,
              category: state.category,
              lockRecord: state.lockRecord,
              terminal: state.terminal,
            }
          : node.data,
      };
    });
  }, [activeWorkflow.graph.states, nodes, selection]);
  const edgesForCanvas = useMemo(() => {
    const endpoints = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));
    const anchors = assignWorkflowEdgeAnchors(
      nodes.map((node) => ({ id: node.id, position: node.position })),
      endpoints,
      {
        preferredHandles: collectLayoutEdgeHandles(
          activeWorkflow.layout,
          endpoints.map((edge) => edge.id)
        ),
      }
    );
    return edges.map((edge) => ({
      ...edge,
      ...workflowFlowEdgePresentation(anchors.get(edge.id), {
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      }),
      reconnectable: canEdit,
      selected: selection?.kind === 'edge' && selection.edgeId === edge.id,
    }));
  }, [activeWorkflow.layout, canEdit, edges, nodes, selection]);

  const handleNodeDragStop = useCallback(
    (_event: unknown, _node: Node, nextNodes: Node[]) => {
      onNodesSettled(nextNodes);
    },
    [onNodesSettled]
  );

  return (
    <FlowCanvas
      className="rounded-lg border"
      nodes={nodesForCanvas}
      edges={edgesForCanvas}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={canEdit ? onNodesChange : undefined}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={canEdit ? handleNodeDragStop : undefined}
      onConnect={canEdit ? onConnect : undefined}
      onReconnect={canEdit ? onReconnect : undefined}
      edgesReconnectable={canEdit}
      reconnectRadius={24}
      onNodeClick={(_event, node) => {
        onSelectionChange({ kind: 'state', stateId: node.id });
      }}
      onEdgeClick={(_event, edge) => {
        onSelectionChange({ kind: 'edge', edgeId: edge.id });
      }}
      onNodeContextMenu={(_event, node) => {
        onSelectionChange({ kind: 'state', stateId: node.id });
      }}
      onEdgeContextMenu={(_event, edge) => {
        onSelectionChange({ kind: 'edge', edgeId: edge.id });
      }}
      onNodeDoubleClick={(event, node) => {
        openSelectionInSettings(
          event,
          {
            kind: 'state',
            stateId: node.id,
          },
          onSelectionChange,
          onOpenSettings
        );
      }}
      onEdgeDoubleClick={(event, edge) => {
        openSelectionInSettings(
          event,
          {
            kind: 'edge',
            edgeId: edge.id,
          },
          onSelectionChange,
          onOpenSettings
        );
      }}
      onPaneClick={() => {
        onSelectionChange(null);
      }}
      nodesDraggable={canEdit}
      nodesConnectable={canEdit}
      elementsSelectable
      edgesFocusable
      panOnScroll
      fitView
      showMiniMap
    />
  );
}

export function WorkflowDesignerWorkspace({
  project,
  canEdit,
  currentUserId = null,
  teams = [],
  members = [],
  initialSettingsOpen = true,
}: WorkflowDesignerWorkspaceProps) {
  const router = useRouter();
  const { handleMutationError } = useOptimisticLock();

  const initialResolved = useMemo(
    () => resolveInitialEnvelope(project.workflow_config),
    [project.workflow_config]
  );

  const [baseline, setBaseline] = useState(() =>
    cloneWorkflowEnvelope(initialResolved.envelope)
  );
  const [draft, setDraft] = useState(() =>
    cloneWorkflowEnvelope(initialResolved.envelope)
  );
  const [usedFallback, setUsedFallback] = useState(
    initialResolved.usedFallback
  );
  const [activeWorkflowId, setActiveWorkflowId] = useState(
    () => initialResolved.envelope.defaultWorkflowId
  );
  const [selection, setSelection] = useState<WorkflowDesignerSelection>(null);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(project.updated_at);
  const [isSaving, setIsSaving] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [deleteWorkflowOpen, setDeleteWorkflowOpen] = useState(false);
  const [importWorkflowOpen, setImportWorkflowOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [stateClipboard, setStateClipboard] =
    useState<WorkflowStateClipboard | null>(null);

  const undoStackRef = useRef(createWorkflowUndoStack());
  const draftRef = useRef(draft);
  const selectionRef = useRef(selection);
  const stateClipboardRef = useRef(stateClipboard);
  const activeWorkflowRef = useRef(
    findWorkflowById(draft, activeWorkflowId) ?? draft.workflows[0]!
  );
  draftRef.current = draft;
  selectionRef.current = selection;
  stateClipboardRef.current = stateClipboard;

  const resetUndo = useCallback(() => {
    undoStackRef.current = clearWorkflowUndo();
  }, []);

  const pushUndo = useCallback((coalesceKey?: string) => {
    undoStackRef.current = pushWorkflowUndo(
      undoStackRef.current,
      draftRef.current,
      { coalesceKey }
    );
  }, []);

  useEffect(() => {
    if (!message || messageIsError) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMessage(null);
    }, SUCCESS_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [message, messageIsError]);

  useEffect(() => {
    const next = resolveInitialEnvelope(project.workflow_config);
    setBaseline(cloneWorkflowEnvelope(next.envelope));
    setDraft(cloneWorkflowEnvelope(next.envelope));
    setUsedFallback(next.usedFallback);
    setActiveWorkflowId((current) =>
      findWorkflowById(next.envelope, current)
        ? current
        : next.envelope.defaultWorkflowId
    );
    setSelection(null);
    setUpdatedAt(project.updated_at);
    setCanvasEpoch((epoch) => epoch + 1);
    undoStackRef.current = clearWorkflowUndo();
    setStateClipboard(null);
  }, [project.workflow_config, project.updated_at]);

  const activeWorkflow = useMemo(() => {
    return (
      findWorkflowById(draft, activeWorkflowId) ??
      findWorkflowById(draft, draft.defaultWorkflowId) ??
      draft.workflows[0]!
    );
  }, [activeWorkflowId, draft]);
  activeWorkflowRef.current = activeWorkflow;

  // Fallback envelope is not persisted yet — allow Save even before layout edits.
  const dirty = usedFallback || !envelopesEqualForDesigner(draft, baseline);
  const isDefaultWorkflow = activeWorkflow.id === draft.defaultWorkflowId;
  const canDeleteWorkflow = draft.workflows.length > 1 && !isDefaultWorkflow;
  const manageBusy = isSaving || isManaging;

  const updateActiveWorkflow = useCallback(
    // eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
    (updater: (workflow: WorkflowDocument) => WorkflowDocument) => {
      setDraft((current) => {
        const currentWorkflow =
          findWorkflowById(current, activeWorkflowId) ??
          findWorkflowById(current, current.defaultWorkflowId) ??
          current.workflows[0]!;
        return replaceWorkflowInEnvelope(current, updater(currentWorkflow));
      });
    },
    [activeWorkflowId]
  );

  const handleNodesSettled = useCallback(
    (nextNodes: Node[]) => {
      updateActiveWorkflow((workflow) =>
        applyNodePositionsToDocument(workflow, nextNodes)
      );
    },
    [updateActiveWorkflow]
  );

  const handleStateChange = useCallback(
    (
      stateId: string,
      patch: Partial<
        Pick<
          WorkflowStateNode,
          'name' | 'category' | 'lockRecord' | 'terminal' | 'requiresEscalation'
        >
      >
    ) => {
      const coalesceKey =
        'name' in patch
          ? `state-name:${stateId}`
          : `state-patch:${stateId}:${Object.keys(patch)
              .sort((a, b) => a.localeCompare(b))
              .join(',')}`;
      pushUndo(coalesceKey);
      updateActiveWorkflow((workflow) =>
        patchStateInDocument(workflow, stateId, patch)
      );
    },
    [pushUndo, updateActiveWorkflow]
  );

  const handleMakeStateTerminal = useCallback(
    (stateId: string) => {
      pushUndo();
      updateActiveWorkflow((workflow) =>
        makeStateTerminalInDocument(workflow, stateId)
      );
      setCanvasEpoch((epoch) => epoch + 1);
    },
    [pushUndo, updateActiveWorkflow]
  );

  const handleSettingsOpenChange = useCallback(
    (open: boolean) => {
      setSettingsOpen(open);
      persistWorkflowDesignerSettingsOpen(currentUserId, open);
    },
    [currentUserId]
  );

  const handleOpenSettings = useCallback(() => {
    handleSettingsOpenChange(true);
  }, [handleSettingsOpenChange]);

  const handleEdgeChange = useCallback(
    (
      edgeId: string,
      patch: Partial<
        Pick<
          WorkflowEdge,
          | 'requireChildren'
          | 'requireLinkedIssues'
          | 'allowAnyOf'
          | 'requiresEscalation'
          | 'resolutionPresetId'
        >
      >
    ) => {
      pushUndo(
        `edge-patch:${edgeId}:${Object.keys(patch)
          .sort((a, b) => a.localeCompare(b))
          .join(',')}`
      );
      updateActiveWorkflow((workflow) =>
        patchEdgeInDocument(workflow, edgeId, patch)
      );
    },
    [pushUndo, updateActiveWorkflow]
  );

  const handleUpsertResolutionPreset = useCallback(
    (preset: WorkflowResolutionPreset) => {
      pushUndo(`preset:${preset.id}`);
      updateActiveWorkflow((workflow) =>
        upsertResolutionPreset(workflow, preset)
      );
    },
    [pushUndo, updateActiveWorkflow]
  );

  const handleAddState = useCallback(() => {
    if (!canEdit) {
      return;
    }
    pushUndo();
    const added = addStateToDocument(activeWorkflowRef.current);
    setDraft((current) => replaceWorkflowInEnvelope(current, added.document));
    setSelection({ kind: 'state', stateId: added.stateId });
    handleSettingsOpenChange(true);
    setCanvasEpoch((epoch) => epoch + 1);
  }, [canEdit, handleSettingsOpenChange, pushUndo]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) {
        return;
      }
      const from = connection.source;
      const to = connection.target;
      if (!from || !to) {
        return;
      }
      const allowed = canConnectWorkflowStates(
        activeWorkflowRef.current,
        from,
        to
      );
      if (!allowed.ok) {
        toast.error(allowed.reason);
        return;
      }
      const handles =
        connection.sourceHandle && connection.targetHandle
          ? {
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
            }
          : null;
      let edgeId = '';
      pushUndo();
      updateActiveWorkflow((workflow) => {
        const result = addEdgeToDocument(workflow, from, to, handles);
        if (!result.ok) {
          return workflow;
        }
        edgeId = result.edgeId;
        return result.document;
      });
      if (edgeId) {
        setSelection({ kind: 'edge', edgeId });
        setCanvasEpoch((epoch) => epoch + 1);
      }
    },
    [canEdit, pushUndo, updateActiveWorkflow]
  );

  const handleReconnect = useCallback(
    (edge: Edge, connection: Connection) => {
      if (!canEdit) {
        return;
      }
      const from = connection.source;
      const to = connection.target;
      const sourceHandle = connection.sourceHandle;
      const targetHandle = connection.targetHandle;
      if (!from || !to || !sourceHandle || !targetHandle) {
        return;
      }
      const graphEdge = activeWorkflowRef.current.graph.edges.find(
        (item) => item.id === edge.id
      );
      if (!graphEdge) {
        toast.error('Transition not found.');
        return;
      }
      if (graphEdge.from !== from || graphEdge.to !== to) {
        toast.error(
          'Reconnect only moves connection points on the same transition. Delete and create a new one to change states.'
        );
        return;
      }
      pushUndo();
      updateActiveWorkflow((workflow) => {
        const result = updateEdgeHandlesInDocument(workflow, edge.id, {
          sourceHandle,
          targetHandle,
        });
        return result.ok ? result.document : workflow;
      });
      setSelection({ kind: 'edge', edgeId: edge.id });
      setCanvasEpoch((epoch) => epoch + 1);
    },
    [canEdit, pushUndo, updateActiveWorkflow]
  );

  const handleDeleteState = useCallback(
    (stateId: string) => {
      const preview = removeStateFromDocument(
        activeWorkflowRef.current,
        stateId
      );
      if (!preview.ok) {
        toast.error(preview.reason);
        return;
      }
      pushUndo();
      updateActiveWorkflow(() => preview.document);
      setSelection(null);
      setCanvasEpoch((epoch) => epoch + 1);
    },
    [pushUndo, updateActiveWorkflow]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      pushUndo();
      updateActiveWorkflow((workflow) =>
        removeEdgeFromDocument(workflow, edgeId)
      );
      setSelection(null);
      setCanvasEpoch((epoch) => epoch + 1);
    },
    [pushUndo, updateActiveWorkflow]
  );

  const handleCopyState = useCallback(() => {
    if (!canEdit) {
      return;
    }
    const selected = captureSelectedStateClipboard(
      activeWorkflowRef.current,
      selectionRef.current
    );
    if (!selected) {
      return;
    }
    setStateClipboard(selected.clipboard);
  }, [canEdit]);

  const handleCutState = useCallback(() => {
    if (!canEdit) {
      return;
    }
    const selected = captureSelectedStateClipboard(
      activeWorkflowRef.current,
      selectionRef.current
    );
    if (!selected) {
      return;
    }
    const preview = removeStateFromDocument(
      activeWorkflowRef.current,
      selected.stateId
    );
    if (!preview.ok) {
      toast.error(preview.reason);
      return;
    }
    pushUndo();
    updateActiveWorkflow(() => preview.document);
    setStateClipboard(selected.clipboard);
    setSelection(null);
    setCanvasEpoch((epoch) => epoch + 1);
  }, [canEdit, pushUndo, updateActiveWorkflow]);

  const handlePasteState = useCallback(() => {
    const clipboard = stateClipboardRef.current;
    if (!canEdit || !clipboard) {
      return;
    }
    pushUndo();
    const pasted = pasteStateFromClipboard(
      activeWorkflowRef.current,
      clipboard
    );
    setDraft((current) => replaceWorkflowInEnvelope(current, pasted.document));
    setSelection({ kind: 'state', stateId: pasted.stateId });
    handleSettingsOpenChange(true);
    setCanvasEpoch((epoch) => epoch + 1);
  }, [canEdit, handleSettingsOpenChange, pushUndo]);

  const handleUndo = useCallback(() => {
    if (!canEdit) {
      return;
    }
    const popped = popWorkflowUndo(undoStackRef.current);
    if (!popped) {
      return;
    }
    undoStackRef.current = popped.stack;
    setDraft(cloneWorkflowEnvelope(popped.envelope));
    setSelection(null);
    setCanvasEpoch((epoch) => epoch + 1);
  }, [canEdit]);

  const handleRenameWorkflow = useCallback(
    (title: string) => {
      pushUndo(`rename:${activeWorkflowId}`);
      setDraft((current) =>
        renameWorkflowInEnvelope(current, activeWorkflowId, title)
      );
    },
    [activeWorkflowId, pushUndo]
  );

  const discardChanges = () => {
    setDraft(cloneWorkflowEnvelope(baseline));
    setSelection(null);
    setMessage(null);
    setMessageIsError(false);
    setCanvasEpoch((epoch) => epoch + 1);
    resetUndo();
  };

  const commitSavedEnvelope = useCallback(
    (options: {
      readonly envelope: WorkflowConfigEnvelope;
      readonly nextUpdatedAt: string;
      readonly successMessage: string;
      readonly usedFallback?: boolean;
      readonly nextActiveWorkflowId?: string;
      readonly clearSelection?: boolean;
    }) => {
      const saved = cloneWorkflowEnvelope(options.envelope);
      setDraft(saved);
      setBaseline(cloneWorkflowEnvelope(saved));
      setUsedFallback(options.usedFallback ?? false);
      setUpdatedAt(options.nextUpdatedAt);
      if (options.nextActiveWorkflowId) {
        setActiveWorkflowId(options.nextActiveWorkflowId);
      } else if (options.clearSelection) {
        setActiveWorkflowId((current) =>
          findWorkflowById(saved, current) ? current : saved.defaultWorkflowId
        );
      }
      if (options.clearSelection) {
        setSelection(null);
      }
      setCanvasEpoch((epoch) => epoch + 1);
      resetUndo();
      setMessage(options.successMessage);
      setMessageIsError(false);
      toast.success(options.successMessage, { duration: SUCCESS_FEEDBACK_MS });
      router.refresh();
    },
    [resetUndo, router]
  );

  const [orphanConflict, setOrphanConflict] =
    useState<WorkflowOrphanedStatesConflict | null>(null);
  const [orphanDialogOpen, setOrphanDialogOpen] = useState(false);

  const readOrphanConflict = (
    error: unknown
  ): WorkflowOrphanedStatesConflict | null => {
    if (!(error instanceof ApiError)) {
      return null;
    }
    if (error.code !== WORKFLOW_ORPHANED_STATES_CODE) {
      return null;
    }
    if (isWorkflowOrphanedStatesConflict(error.details)) {
      return error.details;
    }
    return null;
  };

  const performSave = async (
    stateRemaps?: readonly WorkflowStateRemap[]
  ): Promise<{
    readonly ok: boolean;
    readonly updatedAt: string;
  }> => {
    if (!canEdit || isSaving) {
      return { ok: false, updatedAt };
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await runLockedMutationOrThrow({
        mutate: () =>
          putProjectWorkflowConfig(project.id, draft, updatedAt, stateRemaps),
        handleMutationError,
        entityType: 'project',
        entityId: project.id,
        expectedUpdatedAt: updatedAt,
        pendingFields: { workflow_config: draft },
        currentUserId,
      });
      if (!result) {
        return { ok: false, updatedAt };
      }
      setOrphanDialogOpen(false);
      setOrphanConflict(null);
      commitSavedEnvelope({
        envelope: result.config,
        nextUpdatedAt: result.updatedAt,
        usedFallback: result.usedFallback,
        successMessage: 'Workflow saved.',
      });
      return { ok: true, updatedAt: result.updatedAt };
    } catch (error) {
      const conflict = readOrphanConflict(error);
      if (conflict) {
        setOrphanConflict(conflict);
        setOrphanDialogOpen(true);
        setMessage(conflict.message);
        setMessageIsError(true);
        return { ok: false, updatedAt };
      }
      const detail =
        error instanceof Error ? error.message : 'Could not save the workflow.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
      return { ok: false, updatedAt };
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    performSave().catch((error: unknown) => {
      const detail =
        error instanceof Error ? error.message : 'Could not save the workflow.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
    });
  };

  const handleOrphanDiscard = () => {
    setOrphanDialogOpen(false);
    setOrphanConflict(null);
    discardChanges();
    toast.message('Workflow changes discarded.');
  };

  const handleOrphanConfirmRemap = (remaps: readonly WorkflowStateRemap[]) => {
    performSave(remaps).catch((error: unknown) => {
      const detail =
        error instanceof Error ? error.message : 'Could not save the workflow.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
    });
  };

  const getViewContext = useCallback((): ChatWorkflowViewContext => {
    return {
      surface: 'workflow_designer',
      projectId: project.id,
      draftEnvelope: draft,
      expectedUpdatedAt: updatedAt,
      dirty,
    };
  }, [project.id, draft, updatedAt, dirty]);

  const saveIfDirty = useCallback(async () => {
    if (!dirty) {
      return { ok: true, expectedUpdatedAt: updatedAt };
    }
    const result = await performSave();
    return {
      ok: result.ok,
      expectedUpdatedAt: result.updatedAt,
    };
    // performSave closes over current draft/updatedAt; intentional per-click.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save uses latest draft state
  }, [dirty, updatedAt, draft, canEdit, isSaving, project.id, currentUserId]);

  const applyEnvelope = useCallback(
    (envelope: WorkflowConfigEnvelope, nextUpdatedAt: string) => {
      commitSavedEnvelope({
        envelope,
        nextUpdatedAt,
        successMessage: 'Workflow proposal applied.',
      });
    },
    [commitSavedEnvelope]
  );

  const applyManagedEnvelope = useCallback(
    (
      envelope: WorkflowConfigEnvelope,
      nextUpdatedAt: string,
      successMessage: string,
      nextActiveWorkflowId?: string
    ) => {
      commitSavedEnvelope({
        envelope,
        nextUpdatedAt,
        successMessage,
        nextActiveWorkflowId,
        clearSelection: true,
      });
    },
    [commitSavedEnvelope]
  );

  const runManageAction = useCallback(
    async (
      action: WorkflowManageAction,
      successMessage: string,
      nextActiveWorkflowId?: WorkflowManageNextId
    ) => {
      if (!canEdit || manageBusy) {
        return;
      }
      setIsManaging(true);
      setMessage(null);
      try {
        const saved = await saveIfDirty();
        if (!saved.ok) {
          return;
        }
        const result = await runLockedMutationOrThrow({
          mutate: () => action(saved.expectedUpdatedAt),
          handleMutationError,
          entityType: 'project',
          entityId: project.id,
          expectedUpdatedAt: saved.expectedUpdatedAt,
          pendingFields: {},
          currentUserId,
        });
        if (!result) {
          return;
        }
        const resolvedNextId =
          typeof nextActiveWorkflowId === 'function'
            ? nextActiveWorkflowId(result)
            : nextActiveWorkflowId;
        applyManagedEnvelope(
          result.config,
          result.updatedAt,
          successMessage,
          resolvedNextId
        );
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : 'Could not update workflows.';
        setMessage(detail);
        setMessageIsError(true);
        toast.error(detail);
      } finally {
        setIsManaging(false);
      }
    },
    [
      applyManagedEnvelope,
      canEdit,
      currentUserId,
      handleMutationError,
      manageBusy,
      project.id,
      saveIfDirty,
    ]
  );

  const handleFork = () => {
    runManageAction(
      (expectedUpdatedAt) =>
        forkProjectWorkflow(project.id, expectedUpdatedAt, {
          sourceWorkflowId: activeWorkflow.id,
        }),
      'Workflow forked.',
      (result) => result.forkedWorkflowId
    ).catch(() => {
      /* errors surfaced in runManageAction */
    });
  };

  const handleImportWorkflow = (input: WorkflowImportSubmitInput) => {
    runManageAction(
      (expectedUpdatedAt) =>
        importProjectWorkflow(project.id, expectedUpdatedAt, input),
      input.markAsDefault
        ? 'Workflow imported and marked as default.'
        : 'Workflow imported.',
      (result) => result.importedWorkflowId
    )
      .then(() => {
        setImportWorkflowOpen(false);
      })
      .catch(() => {
        /* errors surfaced in runManageAction */
      });
  };

  const handleMarkDefault = () => {
    runManageAction(
      (expectedUpdatedAt) =>
        setDefaultProjectWorkflow(
          project.id,
          activeWorkflow.id,
          expectedUpdatedAt
        ),
      'Marked as default workflow.'
    ).catch(() => {
      /* errors surfaced in runManageAction */
    });
  };

  const handleDeleteWorkflow = () => {
    const workflowId = activeWorkflow.id;
    runManageAction(
      (expectedUpdatedAt) =>
        deleteProjectWorkflow(project.id, workflowId, expectedUpdatedAt),
      'Workflow deleted.',
      (result) => result.config.defaultWorkflowId
    )
      .then(() => {
        setDeleteWorkflowOpen(false);
      })
      .catch(() => {
        /* errors surfaced in runManageAction */
      });
  };

  const surfaceBridge = useMemo(
    () =>
      canEdit
        ? {
            projectId: project.id,
            getViewContext,
            saveIfDirty,
            applyEnvelope,
          }
        : null,
    [canEdit, project.id, getViewContext, saveIfDirty, applyEnvelope]
  );

  useRegisterWorkflowAliceBridge(surfaceBridge);

  const deleteSelection = useCallback(() => {
    const current = selectionRef.current;
    if (!current) {
      return;
    }
    if (current.kind === 'state') {
      handleDeleteState(current.stateId);
      return;
    }
    handleDeleteEdge(current.edgeId);
  }, [handleDeleteEdge, handleDeleteState]);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const contextMenuHandlers = useMemo(
    () => ({
      addState: handleAddState,
      copyState: handleCopyState,
      cutState: handleCutState,
      pasteState: handlePasteState,
      undo: handleUndo,
      deleteSelection,
      clearSelection,
    }),
    [
      clearSelection,
      deleteSelection,
      handleAddState,
      handleCopyState,
      handleCutState,
      handlePasteState,
      handleUndo,
    ]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleWorkflowDesignerKeydown(event, {
        canEdit,
        manageBusy,
        hasSelection: Boolean(selectionRef.current),
        handlers: contextMenuHandlers,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canEdit, contextMenuHandlers, manageBusy]);

  const boardHref = `/board?project=${project.id}`;

  return (
    <div
      className="space-y-4"
      data-testid="workflow-designer-workspace"
      data-dirty={dirty ? 'true' : 'false'}
      data-workflow-id={activeWorkflow.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="text-primary size-5" />
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              Workflow designer
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  asChild
                >
                  <Link
                    href={boardHref}
                    aria-label="Go to Board"
                    data-testid="workflow-designer-go-to-board"
                  >
                    <Kanban className="size-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go to Board</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Workflow help"
                  data-testid="workflow-designer-help-open"
                  onClick={() => {
                    setHelpOpen(true);
                  }}
                >
                  <CircleHelp className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Help</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!dirty || manageBusy}
                onClick={discardChanges}
              >
                <RotateCcw data-icon="inline-start" className="size-4" />
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!dirty || manageBusy}
                onClick={handleSaveClick}
              >
                <Save data-icon="inline-start" className="size-4" />
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {!canEdit ? (
        <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-3 rounded-lg border p-3 text-sm">
          <Lock className="size-4 shrink-0 text-amber-500" />
          <span>View only — managers and admins can edit.</span>
        </div>
      ) : null}

      {usedFallback ? (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border p-3 text-sm">
          Using the default workflow. Save to keep it on this project.
        </div>
      ) : null}

      <FormAlertMessage message={message} isError={messageIsError} />

      <div className="flex flex-wrap items-center gap-3">
        <label
          className="text-muted-foreground text-sm font-medium"
          htmlFor="workflow-designer-switcher"
        >
          Workflow
        </label>
        <Select
          value={activeWorkflow.id}
          onValueChange={(value) => {
            if (!value) {
              return;
            }
            setActiveWorkflowId(value);
            setSelection(null);
            setCanvasEpoch((epoch) => epoch + 1);
          }}
        >
          <SelectTrigger id="workflow-designer-switcher" className="w-55">
            <SelectValue placeholder="Select workflow" />
          </SelectTrigger>
          <SelectContent>
            {draft.workflows.map((workflow) => (
              <SelectItem key={workflow.id} value={workflow.id}>
                {workflow.title}
                {workflow.id === draft.defaultWorkflowId ? ' (default)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit ? (
          <Input
            aria-label="Workflow title"
            className="w-48"
            value={activeWorkflow.title}
            disabled={manageBusy}
            data-testid="workflow-designer-rename"
            onChange={(event) => {
              handleRenameWorkflow(event.target.value);
            }}
          />
        ) : null}
        <span className="text-muted-foreground text-xs">
          {activeWorkflow.graph.states.length} states ·{' '}
          {activeWorkflow.graph.edges.length} transitions
        </span>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={manageBusy || Boolean(activeWorkflow.forkedFromId)}
              data-testid="workflow-designer-fork"
              onClick={handleFork}
            >
              <GitFork data-icon="inline-start" className="size-4" />
              Fork
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={manageBusy}
              data-testid="workflow-designer-import"
              onClick={() => {
                setImportWorkflowOpen(true);
              }}
            >
              <Download data-icon="inline-start" className="size-4" />
              Import
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={manageBusy || isDefaultWorkflow}
              data-testid="workflow-designer-mark-default"
              onClick={handleMarkDefault}
            >
              <Star data-icon="inline-start" className="size-4" />
              Mark default
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={manageBusy || !canDeleteWorkflow}
              data-testid="workflow-designer-delete"
              onClick={() => {
                setDeleteWorkflowOpen(true);
              }}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex h-[min(560px,calc(100dvh-16rem))] min-h-80 gap-4 pb-2">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="min-h-0 min-w-0 flex-1">
              <ReactFlowProvider>
                <WorkflowDesignerCanvas
                  key={`${activeWorkflow.id}:${canvasEpoch}`}
                  activeWorkflow={activeWorkflow}
                  canEdit={canEdit}
                  selection={selection}
                  onNodesSettled={handleNodesSettled}
                  onSelectionChange={setSelection}
                  onOpenSettings={handleOpenSettings}
                  onConnect={handleConnect}
                  onReconnect={handleReconnect}
                />
              </ReactFlowProvider>
            </div>
          </ContextMenuTrigger>
          <WorkflowDesignerContextMenuContent
            canEdit={canEdit}
            manageBusy={manageBusy}
            hasSelection={Boolean(selection)}
            hasStateSelection={selection?.kind === 'state'}
            hasClipboard={Boolean(stateClipboard)}
            handlers={contextMenuHandlers}
          />
        </ContextMenu>
        <WorkflowDesignerSettings
          selection={selection}
          workflow={activeWorkflow}
          isDefaultWorkflow={isDefaultWorkflow}
          canEdit={canEdit}
          teams={teams}
          members={members}
          onStateChange={handleStateChange}
          onEdgeChange={handleEdgeChange}
          onMakeStateTerminal={handleMakeStateTerminal}
          onDeleteState={handleDeleteState}
          onDeleteEdge={handleDeleteEdge}
          onUpsertResolutionPreset={handleUpsertResolutionPreset}
          open={settingsOpen}
          onOpenChange={handleSettingsOpenChange}
        />
      </div>

      <WorkflowDesignerHelp open={helpOpen} onOpenChange={setHelpOpen} />

      <WorkflowOrphanedStatesDialog
        conflict={orphanConflict}
        open={orphanDialogOpen}
        isSaving={isSaving}
        onOpenChange={(open) => {
          setOrphanDialogOpen(open);
          if (!open) {
            setOrphanConflict(null);
          }
        }}
        onDiscard={handleOrphanDiscard}
        onConfirmRemap={handleOrphanConfirmRemap}
      />

      <Dialog open={deleteWorkflowOpen} onOpenChange={setDeleteWorkflowOpen}>
        <DialogContent data-testid="workflow-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete this workflow?</DialogTitle>
            <DialogDescription>
              Removes{' '}
              <span className="font-medium">{activeWorkflow.title}</span> from
              this project. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={manageBusy}
              onClick={() => {
                setDeleteWorkflowOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={manageBusy}
              onClick={handleDeleteWorkflow}
            >
              {isManaging ? 'Deleting…' : 'Delete workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkflowImportDialog
        open={importWorkflowOpen}
        onOpenChange={setImportWorkflowOpen}
        currentProjectId={project.id}
        busy={manageBusy}
        onImport={handleImportWorkflow}
      />
    </div>
  );
}
