import type { WorkItemPriority, WorkItemType } from '@repo/types';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { User as DbUser } from '@/app/users/_services/users.service';

export type WorkItemFormMember = Pick<DbUser, 'id' | 'name' | 'email'>;

/**
 * Controlled field props shared by classic and modern create/edit layouts.
 */
export type WorkItemFormSharedFieldProps = {
  readonly projects: DbProject[];
  readonly projectMembers: readonly WorkItemFormMember[];
  readonly availableTypes: readonly WorkItemType[];
  readonly projectId: string;
  readonly assigneeId: string;
  readonly type: string;
  readonly priority: WorkItemPriority;
  readonly parentId?: string | null;
  readonly lockProject: boolean;
  readonly lockAssignee: boolean;
  readonly typeLocked: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onProjectIdChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onAssigneeIdChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onTypeChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onPriorityChange: (value: WorkItemPriority) => void;
};
