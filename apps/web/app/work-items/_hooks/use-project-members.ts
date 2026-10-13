import { useCallback } from 'react';
import { fetchProjectMembersForForm } from '@/lib/form-read-actions';
import type { WorkItemMemberLike } from '@/app/work-items/_helpers/work-item-member';
import { useProjectResourceOptions } from '@/app/work-items/_hooks/use-project-resource-options';

export type UseProjectMembersArgs = {
  readonly projectId: string;
  readonly projectMembers: readonly WorkItemMemberLike[];
  readonly assigneeId: string | null | undefined;
  readonly lockAssignee?: boolean;
  /**
   * When true, skip network fetch and keep using the provided `projectMembers`
   * list (e.g. charts mock board, dialog bootstrap).
   */
  readonly preferProvidedMembers?: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onAssigneeChange: (assigneeId: string | null) => void;
};

export type UseProjectMembersResult = {
  readonly members: readonly WorkItemMemberLike[];
  readonly isLoading: boolean;
};

export function useProjectMembers({
  projectId,
  projectMembers,
  assigneeId,
  lockAssignee = false,
  preferProvidedMembers = false,
  onAssigneeChange,
}: UseProjectMembersArgs): UseProjectMembersResult {
  const fetchOptions = useCallback(async (id: string) => {
    try {
      return await fetchProjectMembersForForm(id);
    } catch (err) {
      console.error('Failed to fetch project members:', err);
      throw err;
    }
  }, []);

  const { options, isLoading } = useProjectResourceOptions({
    projectId,
    provided: projectMembers,
    selectedId: assigneeId,
    preferProvided: preferProvidedMembers,
    clearWhenMissing: !lockAssignee,
    onSelectionChange: onAssigneeChange,
    fetchOptions,
    noProjectOptions: projectMembers,
  });

  return { members: options, isLoading };
}
