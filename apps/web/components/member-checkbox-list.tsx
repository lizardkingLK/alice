'use client';

import { useMemo } from 'react';
import {
  CheckboxOptionList,
  type CheckboxOption,
} from '@/components/checkbox-option-list';

export type MemberCheckboxOption = {
  readonly userId: string;
  readonly name: string;
  readonly email?: string;
  readonly role?: string;
};

type MemberCheckboxListProps = {
  readonly members: readonly MemberCheckboxOption[];
  readonly selectedUserIds: readonly string[];
  // eslint-disable-next-line no-unused-vars -- selection change callback
  readonly onSelectedUserIdsChange: (userIds: string[]) => void;
  readonly emptyText?: string;
  readonly checkboxIdPrefix?: string;
  readonly disabled?: boolean;
  readonly excludeUserIds?: readonly string[];
  readonly listClassName?: string;
};

function toMemberCheckboxOptions(
  members: readonly MemberCheckboxOption[]
): CheckboxOption[] {
  return members.map((member) => ({
    id: member.userId,
    label: member.name,
    secondaryLabel:
      [member.email, member.role].filter(Boolean).join(' • ') || undefined,
  }));
}

export function MemberCheckboxList({
  members,
  selectedUserIds,
  onSelectedUserIdsChange,
  emptyText = 'No active members found in this project.',
  checkboxIdPrefix = 'member-checkbox',
  disabled = false,
  excludeUserIds,
  listClassName,
}: Readonly<MemberCheckboxListProps>) {
  const options = useMemo(() => {
    const excluded = excludeUserIds?.length ? new Set(excludeUserIds) : null;
    const visibleMembers = excluded
      ? members.filter((member) => !excluded.has(member.userId))
      : members;
    return toMemberCheckboxOptions(visibleMembers);
  }, [excludeUserIds, members]);

  return (
    <CheckboxOptionList
      options={options}
      selectedIds={selectedUserIds}
      onSelectedIdsChange={onSelectedUserIdsChange}
      emptyText={emptyText}
      checkboxIdPrefix={checkboxIdPrefix}
      disabled={disabled}
      listClassName={listClassName}
    />
  );
}
