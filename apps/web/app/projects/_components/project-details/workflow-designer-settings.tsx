'use client';

import { useState, type ReactNode } from 'react';
import { PanelRightClose, Settings, Trash2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import {
  WORKFLOW_REQUIRE_CHILDREN,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowRequireChildren,
  type WorkflowResolutionPreset,
  type WorkflowStateNode,
} from '@repo/types/api/v1';
import {
  WORKFLOW_STATE_CATEGORIES,
  type WorkflowStateCategory,
} from '@repo/types';
import {
  TransitionRulePermissions,
  type TransitionRulePermissionsValue,
  type TransitionRuleTeamOption,
} from '@/app/projects/_components/project-details/transition-rule-permissions';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import { WORK_ITEM_STATUS_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-status';
import { WorkflowResolutionPresetEditor } from '@/app/projects/_components/project-details/workflow-resolution-preset-editor';
import { WorkflowSettingsInfoTip } from '@/app/projects/_components/project-details/workflow-settings-info-tip';
import { cn } from '@repo/ui/lib/utils';

export type WorkflowDesignerSelection =
  | { readonly kind: 'state'; readonly stateId: string }
  | { readonly kind: 'edge'; readonly edgeId: string }
  | null;

export type WorkflowStateSettingsPatch = Partial<
  Pick<
    WorkflowStateNode,
    'name' | 'category' | 'lockRecord' | 'terminal' | 'requiresEscalation'
  >
>;

/* eslint-disable no-unused-vars -- callback parameter names document the payload */
type WorkflowStateChangeHandler = (
  stateId: string,
  patch: WorkflowStateSettingsPatch
) => void;
type WorkflowEdgeChangeHandler = (
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
) => void;
type WorkflowMakeTerminalHandler = (stateId: string) => void;
type WorkflowDeleteStateHandler = (stateId: string) => void;
type WorkflowDeleteEdgeHandler = (edgeId: string) => void;
type WorkflowSettingsOpenChangeHandler = (open: boolean) => void;
type WorkflowResolutionPresetUpsertHandler = (
  preset: WorkflowResolutionPreset
) => void;
/* eslint-enable no-unused-vars */

type WorkflowDesignerSettingsProps = {
  readonly selection: WorkflowDesignerSelection;
  readonly workflow: WorkflowDocument;
  readonly canEdit: boolean;
  readonly teams: readonly TransitionRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly onStateChange: WorkflowStateChangeHandler;
  readonly onEdgeChange: WorkflowEdgeChangeHandler;
  readonly onMakeStateTerminal: WorkflowMakeTerminalHandler;
  readonly onDeleteState: WorkflowDeleteStateHandler;
  readonly onDeleteEdge: WorkflowDeleteEdgeHandler;
  readonly onUpsertResolutionPreset: WorkflowResolutionPresetUpsertHandler;
  /** Controlled open state (workspace owns cookie/localStorage persist). */
  readonly open: boolean;
  readonly onOpenChange: WorkflowSettingsOpenChangeHandler;
};

/** Labels match board status wording (representative status per category). */
const CATEGORY_LABELS: Record<WorkflowStateCategory, string> = {
  draft: 'Draft',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

/** Lighter board badge surfaces for category options (same tokens as kanban). */
const CATEGORY_BADGE_CLASS: Record<WorkflowStateCategory, string> = {
  draft: WORK_ITEM_STATUS_BADGE_STYLES.Draft,
  todo: WORK_ITEM_STATUS_BADGE_STYLES.ToDo,
  in_progress: WORK_ITEM_STATUS_BADGE_STYLES.InProgress,
  done: WORK_ITEM_STATUS_BADGE_STYLES.Done,
};

const REQUIRE_CHILDREN_LABELS: Record<WorkflowRequireChildren, string> = {
  off: 'Off',
  all_complete: 'All complete',
  match_parent_target: 'Match parent target',
};

function FieldLabel({
  htmlFor,
  label,
  tip,
}: {
  readonly htmlFor: string;
  readonly label: string;
  readonly tip: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <WorkflowSettingsInfoTip text={tip} />
    </div>
  );
}

function WorkflowSettingsConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  testId,
  onConfirm,
}: {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly testId: string;
  readonly onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
type StateFlagCheckedHandler = (checked: boolean) => void;

function StateFlagRow({
  id,
  label,
  tip,
  checked,
  disabled,
  onCheckedChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly tip: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onCheckedChange: StateFlagCheckedHandler;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="leading-snug">
            {label}
          </Label>
          <WorkflowSettingsInfoTip text={tip} />
        </div>
      </div>
    </div>
  );
}

function StateSettingsForm({
  state,
  outboundCount,
  connectedEdgeCount,
  canDelete,
  canEdit,
  onStateChange,
  onMakeStateTerminal,
  onDeleteState,
}: {
  readonly state: WorkflowStateNode;
  readonly outboundCount: number;
  readonly connectedEdgeCount: number;
  readonly canDelete: boolean;
  readonly canEdit: boolean;
  readonly onStateChange: WorkflowDesignerSettingsProps['onStateChange'];
  readonly onMakeStateTerminal: WorkflowDesignerSettingsProps['onMakeStateTerminal'];
  readonly onDeleteState: WorkflowDesignerSettingsProps['onDeleteState'];
}) {
  const [terminalConfirmOpen, setTerminalConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const requestTerminal = (checked: boolean) => {
    if (!checked) {
      onStateChange(state.id, { terminal: false });
      return;
    }
    if (outboundCount === 0) {
      onStateChange(state.id, { terminal: true });
      return;
    }
    setTerminalConfirmOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="workflow-settings-state">
      <div>
        <p className="text-foreground text-sm font-medium">State</p>
      </div>

      <div className="space-y-2">
        <FieldLabel
          htmlFor="workflow-state-name"
          label="Name"
          tip="Shown on the board and in status menus."
        />
        <Input
          id="workflow-state-name"
          value={state.name}
          disabled={!canEdit}
          onChange={(event) =>
            onStateChange(state.id, { name: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <FieldLabel
          htmlFor="workflow-state-category"
          label="Category"
          tip="Matches board colors and filters. To Do includes New; In Progress includes Testing."
        />
        <Select
          value={state.category}
          disabled={!canEdit}
          onValueChange={(value) => {
            if (!value) {
              return;
            }
            onStateChange(state.id, {
              category: value as WorkflowStateCategory,
            });
          }}
        >
          <SelectTrigger id="workflow-state-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_STATE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                <span
                  className={cn(
                    'text-foreground! inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                    CATEGORY_BADGE_CLASS[category]
                  )}
                >
                  {CATEGORY_LABELS[category]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border space-y-3 border-t pt-3">
        <StateFlagRow
          id="workflow-state-lock-record"
          label="Lock record in this state"
          tip="Most fields become read-only here. Moving to another state can still be allowed."
          checked={state.lockRecord}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            onStateChange(state.id, { lockRecord: checked })
          }
        />
        <StateFlagRow
          id="workflow-state-terminal"
          label="Terminal state"
          tip="End of the path — no exits. Existing exits are removed when you turn this on."
          checked={state.terminal}
          disabled={!canEdit}
          onCheckedChange={requestTerminal}
        />
      </div>

      {canEdit ? (
        <div className="border-border space-y-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive w-full"
            disabled={!canDelete}
            data-testid="workflow-settings-delete-state"
            onClick={() => {
              if (connectedEdgeCount > 0) {
                setDeleteConfirmOpen(true);
                return;
              }
              onDeleteState(state.id);
            }}
          >
            <Trash2 data-icon="inline-start" className="size-4" />
            Delete state
          </Button>
          {!canDelete ? (
            <p className="text-muted-foreground text-xs">
              A workflow needs at least one state.
            </p>
          ) : null}
        </div>
      ) : null}

      <WorkflowSettingsConfirmDialog
        open={terminalConfirmOpen}
        onOpenChange={setTerminalConfirmOpen}
        testId="workflow-terminal-confirm"
        title="Make this a terminal state?"
        description={
          <>
            This removes {outboundCount} exit
            {outboundCount === 1 ? '' : 's'} from{' '}
            <span className="font-medium">{state.name}</span>
            {'. '}A terminal state has nowhere left to go.
          </>
        }
        confirmLabel="Remove exits"
        onConfirm={() => {
          onMakeStateTerminal(state.id);
        }}
      />

      <WorkflowSettingsConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        testId="workflow-delete-state-confirm"
        title="Delete this state?"
        description={
          <>
            This removes <span className="font-medium">{state.name}</span> and{' '}
            {connectedEdgeCount} connected transition
            {connectedEdgeCount === 1 ? '' : 's'}
            {'.'}
          </>
        }
        confirmLabel="Delete state"
        onConfirm={() => {
          onDeleteState(state.id);
        }}
      />
    </div>
  );
}

function EdgeSettingsForm({
  edge,
  workflow,
  canEdit,
  teams,
  members,
  onEdgeChange,
  onDeleteEdge,
  onUpsertResolutionPreset,
}: {
  readonly edge: WorkflowEdge;
  readonly workflow: WorkflowDocument;
  readonly canEdit: boolean;
  readonly teams: readonly TransitionRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly onEdgeChange: WorkflowDesignerSettingsProps['onEdgeChange'];
  readonly onDeleteEdge: WorkflowDesignerSettingsProps['onDeleteEdge'];
  readonly onUpsertResolutionPreset: WorkflowDesignerSettingsProps['onUpsertResolutionPreset'];
}) {
  const fromState = workflow.graph.states.find(
    (state) => state.id === edge.from
  );
  const fromName = fromState?.name ?? edge.from;
  const toName =
    workflow.graph.states.find((state) => state.id === edge.to)?.name ??
    edge.to;
  const escalationRequired =
    edge.requiresEscalation === true || fromState?.requiresEscalation === true;

  const accessMode: TransitionRulePermissionsValue['accessMode'] =
    edge.allowAnyOf.length > 0 ? 'restricted' : 'everyone';

  return (
    <div className="space-y-4" data-testid="workflow-settings-edge">
      <div>
        <p className="text-foreground text-sm font-medium">Transition</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {fromName} → {toName}
        </p>
      </div>

      <div className="space-y-2">
        <FieldLabel
          htmlFor="workflow-edge-require-children"
          label="Require children"
          tip="Off — no check. All complete — every direct child must be Done. Match parent — children must already be in the target state (or same category when types differ)."
        />
        <Select
          value={edge.requireChildren}
          disabled={!canEdit}
          onValueChange={(value) => {
            if (!value) {
              return;
            }
            onEdgeChange(edge.id, {
              requireChildren: value as WorkflowRequireChildren,
            });
          }}
        >
          <SelectTrigger id="workflow-edge-require-children">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_REQUIRE_CHILDREN.map((option) => (
              <SelectItem key={option} value={option}>
                {REQUIRE_CHILDREN_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border space-y-3 border-t pt-3">
        <StateFlagRow
          id="workflow-edge-requires-escalation"
          label="Requires escalation"
          tip="Turn this on when this move needs a form. Then Create new… or pick a form below, Edit form → Save in the dialog, and Save the workflow — otherwise Save is rejected."
          checked={escalationRequired}
          disabled={!canEdit || fromState?.requiresEscalation === true}
          onCheckedChange={(checked) =>
            onEdgeChange(edge.id, {
              requiresEscalation: checked,
              ...(checked ? {} : { resolutionPresetId: null }),
            })
          }
        />
        {fromState?.requiresEscalation === true ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            The from-state still marks every exit as escalation — link a form
            below, then save.
          </p>
        ) : null}
        <div className="space-y-2">
          <FieldLabel
            htmlFor="workflow-edge-resolution-preset"
            label="Resolution form"
            tip="People complete this form when taking this move. Create new… or choose an existing form, then Save the workflow."
          />
          <WorkflowResolutionPresetEditor
            workflow={workflow}
            edgeId={edge.id}
            presetId={edge.resolutionPresetId}
            canEdit={canEdit}
            required={escalationRequired}
            onBindPreset={(nextPresetId) =>
              onEdgeChange(edge.id, {
                resolutionPresetId: nextPresetId,
                ...(nextPresetId
                  ? { requiresEscalation: true }
                  : { requiresEscalation: false }),
              })
            }
            onUpsertPreset={onUpsertResolutionPreset}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">Who can move</p>
          <WorkflowSettingsInfoTip text="Everyone allows any member. Restricted limits who can take this move." />
        </div>
        <TransitionRulePermissions
          idPrefix={`workflow-edge-${edge.id}`}
          value={{
            accessMode,
            allowAnyOf: edge.allowAnyOf,
          }}
          savedAllowAnyOf={edge.allowAnyOf}
          teams={teams}
          members={members}
          disabled={!canEdit}
          onChange={(next) => {
            onEdgeChange(edge.id, {
              allowAnyOf:
                next.accessMode === 'everyone' ? [] : [...next.allowAnyOf],
            });
          }}
        />
      </div>

      {canEdit ? (
        <div className="border-border border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive w-full"
            data-testid="workflow-settings-delete-edge"
            onClick={() => {
              onDeleteEdge(edge.id);
            }}
          >
            <Trash2 data-icon="inline-start" className="size-4" />
            Delete transition
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowDesignerSettings({
  selection,
  workflow,
  canEdit,
  teams,
  members,
  onStateChange,
  onEdgeChange,
  onMakeStateTerminal,
  onDeleteState,
  onDeleteEdge,
  onUpsertResolutionPreset,
  open,
  onOpenChange,
}: WorkflowDesignerSettingsProps) {
  const selectedState =
    selection?.kind === 'state'
      ? (workflow.graph.states.find(
          (state) => state.id === selection.stateId
        ) ?? null)
      : null;
  const selectedEdge =
    selection?.kind === 'edge'
      ? (workflow.graph.edges.find((edge) => edge.id === selection.edgeId) ??
        null)
      : null;
  const outboundCount = selectedState
    ? workflow.graph.edges.filter((edge) => edge.from === selectedState.id)
        .length
    : 0;
  const connectedEdgeCount = selectedState
    ? workflow.graph.edges.filter(
        (edge) => edge.from === selectedState.id || edge.to === selectedState.id
      ).length
    : 0;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        data-testid="workflow-designer-settings-expand"
        aria-expanded={false}
        aria-controls="workflow-designer-settings-panel"
        aria-label="Expand settings"
        onClick={() => {
          onOpenChange(true);
        }}
        className={cn(
          'border-border bg-muted/20 text-muted-foreground hover:text-foreground',
          'hover:bg-muted/40 h-full min-h-0 w-10 shrink-0 rounded-lg px-0 shadow-none'
        )}
      >
        <Settings className="size-4 shrink-0" />
      </Button>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        id="workflow-designer-settings-panel"
        className="border-border bg-muted/20 flex h-full min-h-0 w-70 shrink-0 flex-col rounded-lg border"
        data-testid="workflow-designer-settings"
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <h3 className="text-foreground text-sm font-semibold">Settings</h3>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="text-muted-foreground hover:text-foreground border-border/60 size-8 bg-transparent shadow-none"
            onClick={() => {
              onOpenChange(false);
            }}
            aria-expanded
            aria-controls="workflow-designer-settings-panel"
            aria-label="Collapse settings"
            data-testid="workflow-designer-settings-collapse"
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {selectedState ? (
            <StateSettingsForm
              state={selectedState}
              outboundCount={outboundCount}
              connectedEdgeCount={connectedEdgeCount}
              canDelete={workflow.graph.states.length > 1}
              canEdit={canEdit}
              onStateChange={onStateChange}
              onMakeStateTerminal={onMakeStateTerminal}
              onDeleteState={onDeleteState}
            />
          ) : null}
          {selectedEdge ? (
            <EdgeSettingsForm
              edge={selectedEdge}
              workflow={workflow}
              canEdit={canEdit}
              teams={teams}
              members={members}
              onEdgeChange={onEdgeChange}
              onDeleteEdge={onDeleteEdge}
              onUpsertResolutionPreset={onUpsertResolutionPreset}
            />
          ) : null}
          {!selectedState && !selectedEdge ? (
            <div className="space-y-3" data-testid="workflow-settings-empty">
              <dl className="text-muted-foreground space-y-2 text-xs">
                <div>
                  <dt className="text-foreground font-medium">
                    Active workflow
                  </dt>
                  <dd>{workflow.title}</dd>
                </div>
                <div>
                  <dt className="text-foreground font-medium">Type bindings</dt>
                  <dd>
                    {workflow.typeBindings.length > 0
                      ? workflow.typeBindings.join(', ')
                      : 'None'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </aside>
    </TooltipProvider>
  );
}
