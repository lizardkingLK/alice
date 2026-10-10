'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  findWorkflowById,
  resolveWorkflowConfig,
  upsertResolutionPreset,
  type ChatWorkflowViewContext,
  type WorkflowConfigEnvelope,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowResolutionPreset,
  type WorkflowStateNode,
} from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  FlowCanvas,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@repo/ui/components/ui/flow-canvas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { toast } from '@repo/ui/components/ui/sonner';
import { GitBranch, Lock, RotateCcw, Save } from '@repo/ui/lib/icons';
import { FormAlertMessage } from '@/components/form-alert-message';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import { putProjectWorkflowConfig } from '@/app/projects/_services/projects.workflow-config.client';
import { WorkflowStateFlowNode } from '@/app/projects/_components/project-details/workflow-state-flow-node';
import { WorkflowTransitionEdge } from '@/app/projects/_components/project-details/workflow-transition-edge';
import {
  WorkflowDesignerSettings,
  type WorkflowDesignerSelection,
} from '@/app/projects/_components/project-details/workflow-designer-settings';
import type { TransitionRuleTeamOption } from '@/app/projects/_components/project-details/transition-rule-permissions';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import {
  WORKFLOW_STATE_NODE_TYPE,
  WORKFLOW_TRANSITION_EDGE_TYPE,
  applyNodePositionsToDocument,
  cloneWorkflowEnvelope,
  envelopesEqualForDesigner,
  makeStateTerminalInDocument,
  patchEdgeInDocument,
  patchStateInDocument,
  replaceWorkflowInEnvelope,
  workflowDocumentToFlowElements,
} from '@/app/projects/_helpers/workflow-designer.layout';
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

function WorkflowDesignerCanvas({
  activeWorkflow,
  canEdit,
  selection,
  onNodesSettled,
  onSelectionChange,
  onOpenSettings,
}: {
  readonly activeWorkflow: WorkflowDocument;
  readonly canEdit: boolean;
  /** Settings-panel selection — also drives marching-ants visuals on the canvas. */
  readonly selection: WorkflowDesignerSelection;
  readonly onNodesSettled: WorkflowNodesSettledHandler;
  readonly onSelectionChange: WorkflowSelectionHandler;
  readonly onOpenSettings: () => void;
}) {
  const initial = workflowDocumentToFlowElements(activeWorkflow);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges as Edge[]);

  // App selection (Settings) is the source of truth. XYFlow's internal
  // `selected` can lag or disagree after clicks; sync explicitly.
  const nodesForCanvas = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: selection?.kind === 'state' && selection.stateId === node.id,
      })),
    [nodes, selection]
  );
  const edgesForCanvas = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        selected: selection?.kind === 'edge' && selection.edgeId === edge.id,
      })),
    [edges, selection]
  );

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
      onNodeClick={(_event, node) => {
        onSelectionChange({ kind: 'state', stateId: node.id });
      }}
      onEdgeClick={(_event, edge) => {
        onSelectionChange({ kind: 'edge', edgeId: edge.id });
      }}
      onNodeDoubleClick={(event, node) => {
        // Dblclick otherwise selects text in the Settings panel as it opens/updates.
        event.preventDefault();
        event.stopPropagation();
        onSelectionChange({ kind: 'state', stateId: node.id });
        onOpenSettings();
        requestAnimationFrame(() => {
          window.getSelection()?.removeAllRanges();
        });
      }}
      onEdgeDoubleClick={(event, edge) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectionChange({ kind: 'edge', edgeId: edge.id });
        onOpenSettings();
        requestAnimationFrame(() => {
          window.getSelection()?.removeAllRanges();
        });
      }}
      onPaneClick={() => {
        onSelectionChange(null);
      }}
      nodesDraggable={canEdit}
      nodesConnectable={false}
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
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

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
  }, [project.workflow_config, project.updated_at]);

  const activeWorkflow = useMemo(() => {
    return (
      findWorkflowById(draft, activeWorkflowId) ??
      findWorkflowById(draft, draft.defaultWorkflowId) ??
      draft.workflows[0]!
    );
  }, [activeWorkflowId, draft]);

  // Fallback envelope is not persisted yet — allow Save even before layout edits.
  const dirty = usedFallback || !envelopesEqualForDesigner(draft, baseline);

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
      updateActiveWorkflow((workflow) =>
        patchStateInDocument(workflow, stateId, patch)
      );
    },
    [updateActiveWorkflow]
  );

  const handleMakeStateTerminal = useCallback(
    (stateId: string) => {
      updateActiveWorkflow((workflow) =>
        makeStateTerminalInDocument(workflow, stateId)
      );
      setCanvasEpoch((epoch) => epoch + 1);
    },
    [updateActiveWorkflow]
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
          | 'allowAnyOf'
          | 'requiresEscalation'
          | 'resolutionPresetId'
        >
      >
    ) => {
      updateActiveWorkflow((workflow) =>
        patchEdgeInDocument(workflow, edgeId, patch)
      );
    },
    [updateActiveWorkflow]
  );

  const handleUpsertResolutionPreset = useCallback(
    (preset: WorkflowResolutionPreset) => {
      updateActiveWorkflow((workflow) =>
        upsertResolutionPreset(workflow, preset)
      );
    },
    [updateActiveWorkflow]
  );

  const discardChanges = () => {
    setDraft(cloneWorkflowEnvelope(baseline));
    setSelection(null);
    setMessage(null);
    setMessageIsError(false);
    setCanvasEpoch((epoch) => epoch + 1);
  };

  const performSave = async (): Promise<{
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
        mutate: () => putProjectWorkflowConfig(project.id, draft, updatedAt),
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
      const saved = cloneWorkflowEnvelope(result.config);
      setDraft(saved);
      setBaseline(cloneWorkflowEnvelope(saved));
      setUsedFallback(result.usedFallback);
      setUpdatedAt(result.updatedAt);
      setCanvasEpoch((epoch) => epoch + 1);
      setMessage('Workflow saved.');
      setMessageIsError(false);
      toast.success('Workflow saved.', { duration: SUCCESS_FEEDBACK_MS });
      router.refresh();
      return { ok: true, updatedAt: result.updatedAt };
    } catch (error) {
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
      const saved = cloneWorkflowEnvelope(envelope);
      setDraft(saved);
      setBaseline(cloneWorkflowEnvelope(saved));
      setUsedFallback(false);
      setUpdatedAt(nextUpdatedAt);
      setCanvasEpoch((epoch) => epoch + 1);
      setMessage('Workflow proposal applied.');
      setMessageIsError(false);
      toast.success('Workflow proposal applied.', {
        duration: SUCCESS_FEEDBACK_MS,
      });
      router.refresh();
    },
    [router]
  );

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
        {canEdit ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dirty || isSaving}
              onClick={discardChanges}
            >
              <RotateCcw data-icon="inline-start" className="size-4" />
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || isSaving}
              onClick={handleSaveClick}
            >
              <Save data-icon="inline-start" className="size-4" />
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : null}
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
        <span className="text-muted-foreground text-xs">
          {activeWorkflow.graph.states.length} states ·{' '}
          {activeWorkflow.graph.edges.length} transitions
        </span>
      </div>

      <div className="flex h-[min(560px,calc(100dvh-16rem))] min-h-80 gap-4 pb-2">
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
            />
          </ReactFlowProvider>
        </div>
        <WorkflowDesignerSettings
          selection={selection}
          workflow={activeWorkflow}
          canEdit={canEdit}
          teams={teams}
          members={members}
          onStateChange={handleStateChange}
          onEdgeChange={handleEdgeChange}
          onMakeStateTerminal={handleMakeStateTerminal}
          onUpsertResolutionPreset={handleUpsertResolutionPreset}
          open={settingsOpen}
          onOpenChange={handleSettingsOpenChange}
        />
      </div>
    </div>
  );
}
