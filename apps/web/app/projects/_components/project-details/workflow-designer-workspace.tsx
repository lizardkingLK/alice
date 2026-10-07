'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  findWorkflowById,
  resolveWorkflowConfig,
  type WorkflowConfigEnvelope,
  type WorkflowDocument,
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
  WORKFLOW_STATE_NODE_TYPE,
  applyNodePositionsToDocument,
  cloneWorkflowEnvelope,
  envelopesEqualForDesigner,
  replaceWorkflowInEnvelope,
  workflowDocumentToFlowElements,
} from '@/app/projects/_helpers/workflow-designer.layout';

type WorkflowDesignerWorkspaceProps = {
  readonly project: Project;
  readonly canEdit: boolean;
  readonly currentUserId?: string | null;
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

function WorkflowDesignerCanvas({
  activeWorkflow,
  canEdit,
  onNodesSettled,
}: {
  readonly activeWorkflow: WorkflowDocument;
  readonly canEdit: boolean;
  readonly onNodesSettled: WorkflowNodesSettledHandler;
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
      nodesDraggable={canEdit}
      nodesConnectable={false}
      elementsSelectable={canEdit}
      edgesFocusable={false}
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

  const handleNodesSettled = useCallback(
    (nextNodes: Node[]) => {
      setDraft((current) => {
        const currentWorkflow =
          findWorkflowById(current, activeWorkflowId) ??
          findWorkflowById(current, current.defaultWorkflowId) ??
          current.workflows[0]!;
        const nextWorkflow = applyNodePositionsToDocument(
          currentWorkflow,
          nextNodes
        );
        return replaceWorkflowInEnvelope(current, nextWorkflow);
      });
    },
    [activeWorkflowId]
  );

  const discardChanges = () => {
    setDraft(cloneWorkflowEnvelope(baseline));
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
      setMessage('Workflow layout saved.');
      setMessageIsError(false);
      toast.success('Workflow layout saved.');
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
    <div className="space-y-4" data-testid="workflow-designer-workspace">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="text-primary size-5" />
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              Workflow designer
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            Arrange states on the canvas. Layout is saved separately from
            transition rules — Settings and rule editors arrive in the next
            slices.
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="h-[480px] min-h-[320px]">
          <ReactFlowProvider>
            <WorkflowDesignerCanvas
              key={`${activeWorkflow.id}:${canvasEpoch}`}
              activeWorkflow={activeWorkflow}
              canEdit={canEdit}
              onNodesSettled={handleNodesSettled}
            />
          </ReactFlowProvider>
        </div>
        <aside className="border-border bg-muted/20 rounded-lg border p-4">
          <h3 className="text-foreground text-sm font-semibold">Settings</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Select a state or transition to edit its options. The Settings
            sidebar lands in Step 3b.
          </p>
          <dl className="text-muted-foreground mt-4 space-y-2 text-xs">
            <div>
              <dt className="text-foreground font-medium">Active workflow</dt>
              <dd>{activeWorkflow.title}</dd>
            </div>
            <div>
              <dt className="text-foreground font-medium">Type bindings</dt>
              <dd>
                {activeWorkflow.typeBindings.length > 0
                  ? activeWorkflow.typeBindings.join(', ')
                  : 'None'}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
