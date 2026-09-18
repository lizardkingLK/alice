'use client';

import { type Dispatch, useEffect, useMemo, useState } from 'react';
import {
  type BoardColumn,
  type BoardConfig,
  type BoardRuleMatcher,
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
import { CheckboxOptionList } from '@/components/checkbox-option-list';
import {
  MemberCheckboxList,
  type MemberCheckboxOption,
} from '@/components/member-checkbox-list';
import { SearchableSelect } from '@/components/searchable-select';

export type BoardRuleTeamOption = {
  readonly id: string;
  readonly name: string;
};

type AccessMode = 'everyone' | 'restricted';

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

const ROLE_OPTIONS = [
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'member', label: 'Member' },
] as const;

function matcherSelections(matchers: readonly BoardRuleMatcher[]) {
  return {
    roles: matchers
      .filter((matcher) => matcher.scope === 'role')
      .map((matcher) => matcher.role),
    teamIds: matchers
      .filter((matcher) => matcher.scope === 'team')
      .map((matcher) => matcher.teamId),
    userIds: matchers
      .filter((matcher) => matcher.scope === 'user')
      .map((matcher) => matcher.userId),
  };
}

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
  const [accessMode, setAccessMode] = useState<AccessMode>('everyone');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
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
    const selections = matcherSelections(transition?.allowAnyOf ?? []);
    setAccessMode(transition ? 'restricted' : 'everyone');
    setSelectedRoles(selections.roles);
    setSelectedTeamIds(
      selections.teamIds.filter((teamId) =>
        teams.some((team) => team.id === teamId)
      )
    );
    setSelectedUserIds(
      selections.userIds.filter((userId) =>
        members.some((member) => member.userId === userId)
      )
    );
    setError(null);
  }, [members, open, sourceColumnId, teams, transition]);

  if (!targetColumn) return null;

  const knownTeamIds = new Set(teams.map((team) => team.id));
  const knownUserIds = new Set(members.map((member) => member.userId));
  const staleCount = (transition?.allowAnyOf ?? []).filter((matcher) => {
    if (matcher.scope === 'team') return !knownTeamIds.has(matcher.teamId);
    if (matcher.scope === 'user') return !knownUserIds.has(matcher.userId);
    return false;
  }).length;

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

    if (accessMode === 'everyone') {
      if (config.version === '2') {
        onConfigChange({ ...config, transitions: withoutPair });
      }
      onOpenChange(false);
      return;
    }

    const allowAnyOf: BoardRuleMatcher[] = [
      ...selectedRoles.map(
        (role) => ({ scope: 'role', role }) as BoardRuleMatcher
      ),
      ...selectedTeamIds.map((teamId) => ({ scope: 'team', teamId }) as const),
      ...selectedUserIds.map((userId) => ({ scope: 'user', userId }) as const),
    ];
    if (allowAnyOf.length === 0) {
      setError('Select at least one role, team, or individual.');
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
          allowAnyOf,
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

          <div className="space-y-1.5">
            <Label htmlFor="board-rule-access">Access mode</Label>
            <Select
              value={accessMode}
              onValueChange={(value) => setAccessMode(value as AccessMode)}
              disabled={disabled}
            >
              <SelectTrigger id="board-rule-access" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accessMode === 'restricted' ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                Any selected role, team, or person may make this move.
              </p>
              <div className="space-y-1.5">
                <Label>Roles</Label>
                <CheckboxOptionList
                  options={ROLE_OPTIONS}
                  selectedIds={selectedRoles}
                  onSelectedIdsChange={setSelectedRoles}
                  checkboxIdPrefix="board-rule-role"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teams</Label>
                <CheckboxOptionList
                  options={teams.map((team) => ({
                    id: team.id,
                    label: team.name,
                  }))}
                  selectedIds={selectedTeamIds}
                  onSelectedIdsChange={setSelectedTeamIds}
                  checkboxIdPrefix="board-rule-team"
                  disabled={disabled}
                  emptyText="No active teams are available for this project."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Individuals</Label>
                <MemberCheckboxList
                  members={members}
                  selectedUserIds={selectedUserIds}
                  onSelectedUserIdsChange={setSelectedUserIds}
                  checkboxIdPrefix="board-rule-user"
                  disabled={disabled}
                  emptyText="No active project members are available."
                />
              </div>
            </div>
          ) : null}

          {staleCount > 0 ? (
            <p
              className="text-sm text-amber-700 dark:text-amber-400"
              role="alert"
            >
              {staleCount} saved team or user reference is no longer active in
              this project. It will be removed when you apply this rule.
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
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
