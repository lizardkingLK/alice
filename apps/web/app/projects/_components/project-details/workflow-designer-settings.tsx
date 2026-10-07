'use client';

import { useState } from 'react';
import { Info } from '@repo/ui/lib/icons';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  WORKFLOW_REQUIRE_CHILDREN,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowRequireChildren,
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
  patch: Partial<Pick<WorkflowEdge, 'requireChildren' | 'allowAnyOf'>>
) => void;
type WorkflowMakeTerminalHandler = (stateId: string) => void;
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
};

const CATEGORY_LABELS: Record<WorkflowStateCategory, string> = {
  draft: 'Draft',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const REQUIRE_CHILDREN_LABELS: Record<WorkflowRequireChildren, string> = {
  off: 'Off',
  all_complete: 'All complete',
  match_parent_target: 'Match parent target',
};

function SettingsInfoTip({ text }: { readonly text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center"
          aria-label="More information"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

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
      <SettingsInfoTip text={tip} />
    </div>
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
          <SettingsInfoTip text={tip} />
        </div>
      </div>
    </div>
  );
}

function StateSettingsForm({
  state,
  outboundCount,
  canEdit,
  onStateChange,
  onMakeStateTerminal,
}: {
  readonly state: WorkflowStateNode;
  readonly outboundCount: number;
  readonly canEdit: boolean;
  readonly onStateChange: WorkflowDesignerSettingsProps['onStateChange'];
  readonly onMakeStateTerminal: WorkflowDesignerSettingsProps['onMakeStateTerminal'];
}) {
  const [terminalConfirmOpen, setTerminalConfirmOpen] = useState(false);

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
        <p className="text-muted-foreground mt-0.5 font-mono text-xs">
          {state.id}
        </p>
      </div>

      <div className="space-y-2">
        <FieldLabel
          htmlFor="workflow-state-name"
          label="Name"
          tip="Label shown on the board column and in state pickers."
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
          tip="Used for list filters, charts, and Done-style gates across projects."
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
                {CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border space-y-3 border-t pt-3">
        <StateFlagRow
          id="workflow-state-lock-record"
          label="Lock record in this state"
          tip="While an item is here, most fields are read-only. Changing state (for example reopen) can still be allowed."
          checked={state.lockRecord}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            onStateChange(state.id, { lockRecord: checked })
          }
        />
        <StateFlagRow
          id="workflow-state-terminal"
          label="Terminal state"
          tip="No outbound transitions. If edges already leave this state, confirm removing them before turning this on."
          checked={state.terminal}
          disabled={!canEdit}
          onCheckedChange={requestTerminal}
        />
        <StateFlagRow
          id="workflow-state-requires-escalation"
          label="Requires escalation"
          tip="Leaving this state requires a resolution preset on every outbound transition. Preset picker lands later; Save validates via schema."
          checked={state.requiresEscalation}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            onStateChange(state.id, { requiresEscalation: checked })
          }
        />
        {state.requiresEscalation && outboundCount > 0 ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Outbound edges must reference a resolution preset before Save
            succeeds. Preset editing arrives in a later milestone.
          </p>
        ) : null}
      </div>

      <Dialog open={terminalConfirmOpen} onOpenChange={setTerminalConfirmOpen}>
        <DialogContent data-testid="workflow-terminal-confirm">
          <DialogHeader>
            <DialogTitle>Make this a terminal state?</DialogTitle>
            <DialogDescription>
              This removes {outboundCount} outbound transition
              {outboundCount === 1 ? '' : 's'} from{' '}
              <span className="font-medium">{state.name}</span>
              {'. '}
              Terminal states cannot have exits.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTerminalConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onMakeStateTerminal(state.id);
                setTerminalConfirmOpen(false);
              }}
            >
              Remove outbound and lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
}: {
  readonly edge: WorkflowEdge;
  readonly workflow: WorkflowDocument;
  readonly canEdit: boolean;
  readonly teams: readonly TransitionRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly onEdgeChange: WorkflowDesignerSettingsProps['onEdgeChange'];
}) {
  const fromState = workflow.graph.states.find(
    (state) => state.id === edge.from
  );
  const fromName = fromState?.name ?? edge.from;
  const toName =
    workflow.graph.states.find((state) => state.id === edge.to)?.name ??
    edge.to;
  const fromRequiresEscalation = fromState?.requiresEscalation === true;

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
          tip="Off — no check. All complete — every direct child must be in a done category. Match parent target — children must already be in the parent’s target state (or same category when workflows differ)."
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

      <div className="space-y-2">
        <FieldLabel
          htmlFor="workflow-edge-resolution-preset"
          label="Resolution preset"
          tip="Optional named form completed when taking this transition. Required when the source state requires escalation."
        />
        <Select disabled value={edge.resolutionPresetId ?? undefined}>
          <SelectTrigger id="workflow-edge-resolution-preset">
            <SelectValue placeholder="Preset picker coming soon" />
          </SelectTrigger>
          <SelectContent>
            {edge.resolutionPresetId ? (
              <SelectItem value={edge.resolutionPresetId}>
                {edge.resolutionPresetId}
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {fromRequiresEscalation && !edge.resolutionPresetId ? (
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            Source state requires escalation — Save will reject until a preset
            is assigned (picker arrives later).
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">Who can move</p>
          <SettingsInfoTip text="Empty (everyone) allows any project member. Restricted mode limits the transition to selected roles, teams, or people." />
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

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className="border-border bg-muted/20 flex h-[480px] min-h-[320px] flex-col rounded-lg border"
        data-testid="workflow-designer-settings"
      >
        <div className="border-border border-b px-4 py-3">
          <h3 className="text-foreground text-sm font-semibold">Settings</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Select a state or transition on the canvas to edit its options.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {selectedState ? (
            <StateSettingsForm
              state={selectedState}
              outboundCount={outboundCount}
              canEdit={canEdit}
              onStateChange={onStateChange}
              onMakeStateTerminal={onMakeStateTerminal}
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
            />
          ) : null}
          {!selectedState && !selectedEdge ? (
            <div className="space-y-3" data-testid="workflow-settings-empty">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nothing selected. Click a state node or transition edge to open
                its settings.
              </p>
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
