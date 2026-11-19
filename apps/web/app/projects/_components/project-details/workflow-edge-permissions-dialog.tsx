'use client';

import { useEffect, useState, type Dispatch } from 'react';
import type { BoardRuleMatcher } from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  createTransitionRulePermissionsValue,
  TransitionRulePermissions,
  type TransitionRulePermissionsValue,
  type TransitionRuleTeamOption,
  validateTransitionRulePermissions,
} from '@/app/projects/_components/project-details/transition-rule-permissions';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import { afterDialogClose } from '@/lib/dialog-close';

type WorkflowEdgePermissionsDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: Dispatch<boolean>;
  readonly fromName: string;
  readonly toName: string;
  readonly savedAllowAnyOf: readonly BoardRuleMatcher[];
  readonly teams: readonly TransitionRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly disabled?: boolean;
  /* eslint-disable-next-line no-unused-vars -- callback docs */
  readonly onApply: (allowAnyOf: readonly BoardRuleMatcher[]) => void;
};

export function WorkflowEdgePermissionsDialog({
  open,
  onOpenChange,
  fromName,
  toName,
  savedAllowAnyOf,
  teams,
  members,
  disabled = false,
  onApply,
}: Readonly<WorkflowEdgePermissionsDialogProps>) {
  const [permissions, setPermissions] =
    useState<TransitionRulePermissionsValue>({
      accessMode: 'restricted',
      allowAnyOf: [],
    });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return afterDialogClose(() => {
        setPermissions({ accessMode: 'restricted', allowAnyOf: [] });
        setError(null);
      });
    }

    setPermissions(
      createTransitionRulePermissionsValue(
        true,
        savedAllowAnyOf,
        teams,
        members
      )
    );
    setError(null);
  }, [members, open, savedAllowAnyOf, teams]);

  const applyRule = () => {
    if (disabled) {
      return;
    }

    if (permissions.accessMode === 'everyone') {
      onApply([]);
      onOpenChange(false);
      return;
    }

    const permissionError = validateTransitionRulePermissions(permissions);
    if (permissionError) {
      setError(permissionError);
      return;
    }

    onApply([...permissions.allowAnyOf]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,48rem)] flex-col overflow-hidden sm:max-w-xl"
        data-testid="workflow-edge-permissions-dialog"
      >
        <DialogHeader>
          <DialogTitle>Who can move</DialogTitle>
          <DialogDescription>
            Restrict who may take {fromName} → {toName}. Pick roles, teams, or
            members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <TransitionRulePermissions
            value={permissions}
            savedAllowAnyOf={savedAllowAnyOf}
            teams={teams}
            members={members}
            idPrefix="workflow-edge-permissions"
            disabled={disabled}
            error={error}
            onChange={(next) => {
              setPermissions(next);
              setError(null);
            }}
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
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
