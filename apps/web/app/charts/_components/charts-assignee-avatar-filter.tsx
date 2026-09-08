'use client';

import { AssigneeAvatarFilter } from '@/components/assignee-avatar-filter';
import {
  CHARTS_SAMPLE_MEMBERS,
  type ChartsSampleMember,
} from '@/app/charts/_components/charts-sample.data';

type ChartsAssigneeAvatarFilterProps = {
  readonly members?: readonly ChartsSampleMember[];
  readonly selectedId: string | null;
  // eslint-disable-next-line no-unused-vars -- assignee toggle
  readonly onSelectedIdChange: (id: string | null) => void;
};

export function ChartsAssigneeAvatarFilter({
  members = CHARTS_SAMPLE_MEMBERS,
  selectedId,
  onSelectedIdChange,
}: Readonly<ChartsAssigneeAvatarFilterProps>) {
  return (
    <AssigneeAvatarFilter
      members={members}
      selectedId={selectedId}
      onSelectedIdChange={onSelectedIdChange}
    />
  );
}
