'use client';

import { Info } from '@repo/ui/lib/icons';
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

/* eslint-disable no-unused-vars -- callback parameter names document the payload */
type WorkflowStateChangeHandler = (
  stateId: string,
  patch: Partial<Pick<WorkflowStateNode, 'name' | 'category'>>
) => void;
type WorkflowEdgeChangeHandler = (
  edgeId: string,
  patch: Partial<Pick<WorkflowEdge, 'requireChildren' | 'allowAnyOf'>>
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

function StateSettingsForm({
  state,
  canEdit,
  onStateChange,
}: {
  readonly state: WorkflowStateNode;
  readonly canEdit: boolean;
  readonly onStateChange: WorkflowDesignerSettingsProps['onStateChange'];
}) {
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

      <p className="text-muted-foreground text-xs leading-relaxed">
        Lock record, Terminal, and escalation options land in the next designer
        slice.
      </p>
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
  const fromName =
    workflow.graph.states.find((state) => state.id === edge.from)?.name ??
    edge.from;
  const toName =
    workflow.graph.states.find((state) => state.id === edge.to)?.name ??
    edge.to;

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
}: WorkflowDesignerSettingsProps) {
  const selectedState =
    selection?.kind === 'state'
      ? (workflow.graph.states.find((state) => state.id === selection.stateId) ??
        null)
      : null;
  const selectedEdge =
    selection?.kind === 'edge'
      ? (workflow.graph.edges.find((edge) => edge.id === selection.edgeId) ??
        null)
      : null;

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
              canEdit={canEdit}
              onStateChange={onStateChange}
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
