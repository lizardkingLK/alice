import { Archive, CircleDot } from '@repo/ui/lib/icons';
import { ProjectStatusEnum } from '@repo/types/api/v1';

export { ProjectStatusEnum };

export type ProjectStatusTab =
  typeof ProjectStatusEnum.active | typeof ProjectStatusEnum.archived;

export const PROJECT_STATUS_TABS = [
  {
    id: ProjectStatusEnum.active,
    label: 'Active',
    icon: CircleDot,
  },
  {
    id: ProjectStatusEnum.archived,
    label: 'Archived',
    icon: Archive,
  },
] as const;

export function isProjectActive(status: string | null | undefined): boolean {
  return status === ProjectStatusEnum.active;
}

export function parseProjectStatusTab(tab?: string | null): ProjectStatusTab {
  if (tab === ProjectStatusEnum.archived) {
    return ProjectStatusEnum.archived;
  }
  return ProjectStatusEnum.active;
}
