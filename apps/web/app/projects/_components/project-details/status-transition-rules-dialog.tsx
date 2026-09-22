'use client';

import { type Dispatch, useEffect, useState } from 'react';
import { WORK_ITEM_STATUSES, type WorkItemStatus } from '@repo/types';
import {
  type BoardConfig,
  type WorkItemStatusTransition,
} from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import {
  createTransitionRulePermissionsValue,
  TransitionRulePermissions,
  type TransitionRulePermissionsValue,
  type TransitionRuleTeamOption,
  validateTransitionRulePermissions,
} from '@/app/projects/_components/project-details/transition-rule-permissions';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';

export type StatusTransitionRuleKey = Pick<
  WorkItemStatusTransition,
  'fromStatus' | 'toStatus'
>;

type StatusTransitionRulesDialogProps = {
  readonly config: BoardConfig;
  readonly ruleToEdit: StatusTransitionRuleKey | null;
  readonly teams: readonly TransitionRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly open: boolean;
  readonly disabled?: boolean;
  readonly onOpenChange: Dispatch<boolean>;
  readonly onConfigChange: Dispatch<BoardConfig>;
};

const EMPTY_STATUS_TRANSITIONS: readonly WorkItemStatusTransition[] = [];

function isSamePair(
  rule: StatusTransitionRuleKey,
  pair: StatusTransitionRuleKey
): boolean {
  return rule.fromStatus === pair.fromStatus && rule.toStatus === pair.toStatus;
}

function firstAvailablePair(
  rules: readonly WorkItemStatusTransition[]
): StatusTransitionRuleKey {
  for (const fromStatus of WORK_ITEM_STATUSES) {
    for (const toStatus of WORK_ITEM_STATUSES) {
      if (
        fromStatus !== toStatus &&
        !rules.some((rule) => isSamePair(rule, { fromStatus, toStatus }))
      ) {
        return { fromStatus, toStatus };
      }
    }
  }

  return {
    fromStatus: WORK_ITEM_STATUSES[0] ?? 'Draft',
    toStatus: WORK_ITEM_STATUSES[1] ?? 'New',
  };
}

export function StatusTransitionRulesDialog({
  config,
  ruleToEdit,
  teams,
  members,
  open,
  disabled = false,
  onOpenChange,
  onConfigChange,
}: Readonly<StatusTransitionRulesDialogProps>) {
  const statusTransitions =
    config.version === '2'
      ? (config.statusTransitions ?? EMPTY_STATUS_TRANSITIONS)
      : EMPTY_STATUS_TRANSITIONS;
  const existingRule = ruleToEdit
    ? statusTransitions.find((rule) => isSamePair(rule, ruleToEdit))
    : undefined;
  const [fromStatus, setFromStatus] = useState<WorkItemStatus>('Draft');
  const [toStatus, setToStatus] = useState<WorkItemStatus>('New');
  const [permissions, setPermissions] =
    useState<TransitionRulePermissionsValue>({
      accessMode: 'restricted',
      allowAnyOf: [],
    });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const pair = existingRule ?? firstAvailablePair(statusTransitions);
    setFromStatus(pair.fromStatus);
    setToStatus(pair.toStatus);
    setPermissions(
      createTransitionRulePermissionsValue(
        true,
        existingRule?.allowAnyOf ?? [],
        teams,
        members
      )
    );
    setError(null);
  }, [existingRule, members, open, statusTransitions, teams]);

  const isUnavailablePair = (
    candidateFromStatus: WorkItemStatus,
    candidateToStatus: WorkItemStatus
  ) => {
    if (candidateFromStatus === candidateToStatus) return true;
    return statusTransitions.some(
      (rule) =>
        (!ruleToEdit || !isSamePair(rule, ruleToEdit)) &&
        isSamePair(rule, {
          fromStatus: candidateFromStatus,
          toStatus: candidateToStatus,
        })
    );
  };

  const applyRule = () => {
    if (disabled) return;

    const withoutOriginal = ruleToEdit
      ? statusTransitions.filter((rule) => !isSamePair(rule, ruleToEdit))
      : [...statusTransitions];

    if (permissions.accessMode === 'everyone') {
      if (config.version === '2' && ruleToEdit) {
        onConfigChange({
          ...config,
          statusTransitions: withoutOriginal,
        });
      }
      onOpenChange(false);
      return;
    }

    if (fromStatus === toStatus) {
      setError('Source and destination statuses must be different.');
      return;
    }
    if (
      withoutOriginal.some((rule) => isSamePair(rule, { fromStatus, toStatus }))
    ) {
      setError('This status transition rule is already configured.');
      return;
    }
    const permissionError = validateTransitionRulePermissions(permissions);
    if (permissionError) {
      setError(permissionError);
      return;
    }

    const statusTransition: WorkItemStatusTransition = {
      fromStatus,
      toStatus,
      allowAnyOf: [...permissions.allowAnyOf],
    };
    onConfigChange(
      config.version === '2'
        ? {
            ...config,
            statusTransitions: [...withoutOriginal, statusTransition],
          }
        : {
            version: '2',
            columns: config.columns,
            transitions: [],
            statusTransitions: [statusTransition],
          }
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,48rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {ruleToEdit
              ? 'Edit status transition rule'
              : 'Add status transition rule'}
          </DialogTitle>
          <DialogDescription>
            Configure who may change a work item between these statuses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-transition-from">Source status</Label>
              <Select
                value={fromStatus}
                onValueChange={(status) =>
                  setFromStatus(status as WorkItemStatus)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  id="status-transition-from"
                  aria-label="Source status"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ITEM_STATUSES.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      disabled={isUnavailablePair(status, toStatus)}
                    >
                      {formatLabelWithSpace(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status-transition-to">Destination status</Label>
              <Select
                value={toStatus}
                onValueChange={(status) =>
                  setToStatus(status as WorkItemStatus)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  id="status-transition-to"
                  aria-label="Destination status"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ITEM_STATUSES.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      disabled={isUnavailablePair(fromStatus, status)}
                    >
                      {formatLabelWithSpace(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TransitionRulePermissions
            value={permissions}
            savedAllowAnyOf={existingRule?.allowAnyOf ?? []}
            teams={teams}
            members={members}
            idPrefix="status-transition-rule"
            disabled={disabled}
            error={error}
            onChange={setPermissions}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={applyRule} disabled={disabled}>
            Apply status transition rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
