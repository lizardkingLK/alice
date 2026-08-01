'use client';

import type { WorkItemMemberLike } from '@/app/work-items/_helpers/work-item-member';
import type { SearchableSelectOption } from '@/components/searchable-select';

type BuildMemberSelectOptionsArgs = {
  readonly members: readonly WorkItemMemberLike[];
  readonly unassignedLabel?: string;
  readonly unassignedValue?: string;
  readonly includeUnassigned?: boolean;
};

/** Options for assignee searchable selects (optional Unassigned row). */
export function buildMemberSelectOptions({
  members,
  unassignedLabel = 'Unassigned',
  unassignedValue = 'unassigned',
  includeUnassigned = true,
}: BuildMemberSelectOptionsArgs): SearchableSelectOption[] {
  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.name,
  }));

  if (!includeUnassigned) {
    return memberOptions;
  }

  return [{ value: unassignedValue, label: unassignedLabel }, ...memberOptions];
}
