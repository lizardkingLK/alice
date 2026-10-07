'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  findWorkflowById,
  resolveWorkflowConfig,
  type WorkflowConfigEnvelope,
  type WorkflowDocument,
  type WorkflowEdge,
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
import {
  WorkflowDesignerSettings,
  type WorkflowDesignerSelection,
} from '@/app/projects/_components/project-details/workflow-designer-settings';
import type { TransitionRuleTeamOption } from '@/app/projects/_components/project-details/transition-rule-permissions';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import {
  WORKFLOW_STATE_NODE_TYPE,
  applyNodePositionsToDocument,
  cloneWorkflowEnvelope,
  envelopesEqualForDesigner,
  makeStateTerminalInDocument,
  patchEdgeInDocument,
  patchStateInDocument,
  replaceWorkflowInEnvelope,
  workflowDocumentToFlowElements,
} from '@/app/projects/_helpers/workflow-designer.layout';

type WorkflowDesignerWorkspaceProps = {
  readonly project: Project;
  readonly canEdit: boolean;
  readonly currentUserId?: string | null;
  readonly teams?: readonly TransitionRuleTeamOption[];
  readonly members?: readonly MemberCheckboxOption[];
};

const nodeTypes = {
  [WORKFLOW_STATE_NODE_TYPE]: WorkflowStateFlowNode,
};

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
  onNodesSettled,
  onSelectionChange,
}: {
  readonly activeWorkflow: WorkflowDocument;
  readonly canEdit: boolean;
  readonly onNodesSettled: WorkflowNodesSettledHandler;
  readonly onSelectionChange: WorkflowSelectionHandler;
}) {
  const initial = workflowDocumentToFlowElements(activeWorkflow);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges as Edge[]);

  const handleNodeDragStop = useCallback(
    (_event: unknown, _node: Node, nextNodes: Node[]) => {
      onNodesSettled(nextNodes);
    },
    [onNodesSettled]
  );

  return (
    <FlowCanvas
      className="rounded-lg border"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={canEdit ? onNodesChange : undefined}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={canEdit ? handleNodeDragStop : undefined}
      onNodeClick={(_event, node) => {
        onSelectionChange({ kind: 'state', stateId: node.id });
      }}
      onEdgeClick={(_event, edge) => {
        onSelectionChange({ kind: 'edge', edgeId: edge.id });
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
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(project.updated_at);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

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

  const handleEdgeChange = useCallback(
    (
      edgeId: string,
      patch: Partial<Pick<WorkflowEdge, 'requireChildren' | 'allowAnyOf'>>
    ) => {
      updateActiveWorkflow((workflow) =>
        patchEdgeInDocument(workflow, edgeId, patch)
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

  const performSave = async (): Promise<boolean> => {
    if (!canEdit || isSaving) {
      return false;
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
        return false;
      }
      const saved = cloneWorkflowEnvelope(result.config);
      setDraft(saved);
      setBaseline(cloneWorkflowEnvelope(saved));
      setUsedFallback(result.usedFallback);
      setUpdatedAt(result.updatedAt);
      setCanvasEpoch((epoch) => epoch + 1);
      setMessage('Workflow configuration saved.');
      setMessageIsError(false);
      toast.success('Workflow configuration saved.');
      router.refresh();
      return true;
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Failed to save workflow configuration.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    performSave().catch((error: unknown) => {
      const detail =
        error instanceof Error
          ? error.message
          : 'Failed to save workflow configuration.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
    });
  };

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
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            Arrange states on the canvas and edit the selected state or
            transition in Settings. Save persists layout and field changes
            together.
          </p>
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
          <span>
            You have view-only access. Only project managers and administrators
            can edit and save workflows.
          </span>
        </div>
      ) : null}

      {usedFallback ? (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border p-3 text-sm">
          No valid workflow envelope was stored yet — showing the seeded
          default. Save to persist it on this project.
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
          <SelectTrigger id="workflow-designer-switcher" className="w-[220px]">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="h-[480px] min-h-[320px]">
          <ReactFlowProvider>
            <WorkflowDesignerCanvas
              key={`${activeWorkflow.id}:${canvasEpoch}`}
              activeWorkflow={activeWorkflow}
              canEdit={canEdit}
              onNodesSettled={handleNodesSettled}
              onSelectionChange={setSelection}
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
        />
      </div>
    </div>
  );
}
