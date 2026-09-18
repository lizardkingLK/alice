'use client';

import { type Dispatch, useEffect, useMemo, useState } from 'react';
import { type BoardColumn, type BoardConfig } from '@repo/types/api/v1';
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
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import { SearchableSelect } from '@/components/searchable-select';
import {
  createTransitionRulePermissionsValue,
  TransitionRulePermissions,
  type TransitionRulePermissionsValue,
  type TransitionRuleTeamOption,
  validateTransitionRulePermissions,
} from '@/app/projects/_components/project-details/transition-rule-permissions';

export type BoardRuleTeamOption = TransitionRuleTeamOption;

type BoardMovementRulesDialogProps = {
  readonly config: BoardConfig;
  readonly targetColumn: BoardColumn | null;
  readonly teams: readonly BoardRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly open: boolean;
  readonly disabled?: boolean;
  readonly onOpenChange: Dispatch<boolean>;
  readonly onConfigChange: Dispatch<BoardConfig>;
};

export function BoardMovementRulesDialog({
  config,
  targetColumn,
  teams,
  members,
  open,
  disabled = false,
  onOpenChange,
  onConfigChange,
}: Readonly<BoardMovementRulesDialogProps>) {
  const sourceColumns = useMemo(
    () => config.columns.filter((column) => column.id !== targetColumn?.id),
    [config.columns, targetColumn?.id]
  );
  const [sourceColumnId, setSourceColumnId] = useState('');
  const [permissions, setPermissions] =
    useState<TransitionRulePermissionsValue>({
      accessMode: 'everyone',
      allowAnyOf: [],
    });
  const [error, setError] = useState<string | null>(null);

  const transition =
    config.version === '2' && targetColumn
      ? config.transitions.find(
          (candidate) =>
            candidate.fromColumnId === sourceColumnId &&
            candidate.toColumnId === targetColumn.id
        )
      : undefined;

  useEffect(() => {
    if (!open) return;
    setSourceColumnId(sourceColumns[0]?.id ?? '');
    setError(null);
  }, [open, sourceColumns]);

  useEffect(() => {
    if (!open) return;
    setPermissions(
      createTransitionRulePermissionsValue(
        Boolean(transition),
        transition?.allowAnyOf ?? [],
        teams,
        members
      )
    );
    setError(null);
  }, [members, open, sourceColumnId, teams, transition]);

  if (!targetColumn) return null;

  const applyRule = () => {
    if (!sourceColumnId || disabled) return;

    const withoutPair =
      config.version === '2'
        ? config.transitions.filter(
            (candidate) =>
              candidate.fromColumnId !== sourceColumnId ||
              candidate.toColumnId !== targetColumn.id
          )
        : [];

    if (permissions.accessMode === 'everyone') {
      if (config.version === '2') {
        onConfigChange({ ...config, transitions: withoutPair });
      }
      onOpenChange(false);
      return;
    }

    const permissionError = validateTransitionRulePermissions(permissions);
    if (permissionError) {
      setError(permissionError);
      return;
    }

    onConfigChange({
      ...config,
      version: '2',
      transitions: [
        ...withoutPair,
        {
          fromColumnId: sourceColumnId,
          toColumnId: targetColumn.id,
          allowAnyOf: [...permissions.allowAnyOf],
        },
      ],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,48rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Movement rules for {targetColumn.name}</DialogTitle>
          <DialogDescription>
            Configure who may move an item from a selected source column into
            this column.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="board-rule-source">Source column</Label>
            <SearchableSelect
              id="board-rule-source"
              ariaLabel="Source column"
              options={sourceColumns.map((column) => ({
                value: column.id,
                label: column.name,
              }))}
              value={sourceColumnId}
              onValueChange={setSourceColumnId}
              disabled={disabled}
              placeholder="Select a source column"
              emptyText="No other columns are available."
            />
          </div>

          <TransitionRulePermissions
            value={permissions}
            savedAllowAnyOf={transition?.allowAnyOf ?? []}
            teams={teams}
            members={members}
            idPrefix="board-rule"
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
          <Button
            type="button"
            onClick={applyRule}
            disabled={disabled || !sourceColumnId}
          >
            Apply movement rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
