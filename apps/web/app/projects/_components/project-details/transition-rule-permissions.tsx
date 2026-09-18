'use client';

import type { Dispatch } from 'react';
import type { BoardRuleMatcher } from '@repo/types/api/v1';
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

export type TransitionRuleTeamOption = {
  readonly id: string;
  readonly name: string;
};

export type TransitionRulePermissionsValue = {
  readonly accessMode: 'everyone' | 'restricted';
  readonly allowAnyOf: readonly BoardRuleMatcher[];
};

type RoleMatcher = Extract<BoardRuleMatcher, { scope: 'role' }>;

type MatcherSelections = {
  readonly roles: RoleMatcher['role'][];
  readonly teamIds: string[];
  readonly userIds: string[];
};

type TransitionRulePermissionsProps = {
  readonly value: TransitionRulePermissionsValue;
  readonly savedAllowAnyOf: readonly BoardRuleMatcher[];
  readonly teams: readonly TransitionRuleTeamOption[];
  readonly members: readonly MemberCheckboxOption[];
  readonly idPrefix: string;
  readonly disabled?: boolean;
  readonly error?: string | null;
  readonly onChange: Dispatch<TransitionRulePermissionsValue>;
};

const ROLE_OPTIONS = [
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'member', label: 'Member' },
] as const;

function matcherSelections(
  matchers: readonly BoardRuleMatcher[]
): MatcherSelections {
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

function selectionsToMatchers({
  roles,
  teamIds,
  userIds,
}: Readonly<MatcherSelections>): BoardRuleMatcher[] {
  return [
    ...roles.map((role) => ({ scope: 'role' as const, role })),
    ...teamIds.map((teamId) => ({ scope: 'team' as const, teamId })),
    ...userIds.map((userId) => ({ scope: 'user' as const, userId })),
  ];
}

export function createTransitionRulePermissionsValue(
  restricted: boolean,
  matchers: readonly BoardRuleMatcher[],
  teams: readonly TransitionRuleTeamOption[],
  members: readonly MemberCheckboxOption[]
): TransitionRulePermissionsValue {
  if (!restricted) {
    return { accessMode: 'everyone', allowAnyOf: [] };
  }

  const selections = matcherSelections(matchers);
  const knownTeamIds = new Set(teams.map((team) => team.id));
  const knownUserIds = new Set(members.map((member) => member.userId));

  return {
    accessMode: 'restricted',
    allowAnyOf: selectionsToMatchers({
      roles: selections.roles,
      teamIds: selections.teamIds.filter((teamId) => knownTeamIds.has(teamId)),
      userIds: selections.userIds.filter((userId) => knownUserIds.has(userId)),
    }),
  };
}

export function validateTransitionRulePermissions(
  value: Readonly<TransitionRulePermissionsValue>
): string | null {
  if (value.accessMode === 'restricted' && value.allowAnyOf.length === 0) {
    return 'Select at least one role, team, or individual.';
  }
  return null;
}

function staleMatcherCount(
  matchers: readonly BoardRuleMatcher[],
  teams: readonly TransitionRuleTeamOption[],
  members: readonly MemberCheckboxOption[]
): number {
  const knownTeamIds = new Set(teams.map((team) => team.id));
  const knownUserIds = new Set(members.map((member) => member.userId));

  return matchers.filter((matcher) => {
    if (matcher.scope === 'team') return !knownTeamIds.has(matcher.teamId);
    if (matcher.scope === 'user') return !knownUserIds.has(matcher.userId);
    return false;
  }).length;
}

export function TransitionRulePermissions({
  value,
  savedAllowAnyOf,
  teams,
  members,
  idPrefix,
  disabled = false,
  error,
  onChange,
}: Readonly<TransitionRulePermissionsProps>) {
  const selections = matcherSelections(value.allowAnyOf);
  const staleCount = staleMatcherCount(savedAllowAnyOf, teams, members);

  const updateSelections = (nextSelections: MatcherSelections) => {
    onChange({
      ...value,
      allowAnyOf: selectionsToMatchers(nextSelections),
    });
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-access`}>Access mode</Label>
        <Select
          value={value.accessMode}
          onValueChange={(accessMode) =>
            onChange({
              ...value,
              accessMode:
                accessMode as TransitionRulePermissionsValue['accessMode'],
            })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-access`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">Everyone</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.accessMode === 'restricted' ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Any selected role, team, or person may make this move.
          </p>
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <CheckboxOptionList
              options={ROLE_OPTIONS}
              selectedIds={selections.roles}
              onSelectedIdsChange={(roles) =>
                updateSelections({
                  ...selections,
                  roles: roles as RoleMatcher['role'][],
                })
              }
              checkboxIdPrefix={`${idPrefix}-role`}
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
              selectedIds={selections.teamIds}
              onSelectedIdsChange={(teamIds) =>
                updateSelections({ ...selections, teamIds })
              }
              checkboxIdPrefix={`${idPrefix}-team`}
              disabled={disabled}
              emptyText="No active teams are available for this project."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Individuals</Label>
            <MemberCheckboxList
              members={members}
              selectedUserIds={selections.userIds}
              onSelectedUserIdsChange={(userIds) =>
                updateSelections({ ...selections, userIds })
              }
              checkboxIdPrefix={`${idPrefix}-user`}
              disabled={disabled}
              emptyText="No active project members are available."
            />
          </div>
        </div>
      ) : null}

      {staleCount > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="alert">
          {staleCount} saved team or user reference is no longer active in this
          project. It will be removed when you apply this rule.
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
