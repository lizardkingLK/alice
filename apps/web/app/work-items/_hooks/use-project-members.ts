import { useEffect, useRef, useState } from 'react';
import { fetchProjectMembersForForm } from '@/lib/form-read-actions';
import type { WorkItemMemberLike } from '@/app/work-items/_helpers/work-item-member';

export type UseProjectMembersArgs = {
  readonly projectId: string;
  readonly projectMembers: readonly WorkItemMemberLike[];
  readonly assigneeId: string | null | undefined;
  readonly lockAssignee?: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onAssigneeChange: (assigneeId: string | null) => void;
};

export function useProjectMembers({
  projectId,
  projectMembers,
  assigneeId,
  lockAssignee = false,
  onAssigneeChange,
}: UseProjectMembersArgs) {
  const [currentMembers, setCurrentMembers] = useState<
    readonly WorkItemMemberLike[]
  >(() => {
    if (!projectId) {
      return projectMembers;
    }
    if (assigneeId) {
      const initialAssignee = projectMembers.find((m) => m.id === assigneeId);
      if (initialAssignee) {
        return [initialAssignee];
      }
    }
    return [];
  });

  const assigneeIdRef = useRef(assigneeId);
  useEffect(() => {
    assigneeIdRef.current = assigneeId;
  }, [assigneeId]);

  const onAssigneeChangeRef = useRef(onAssigneeChange);
  useEffect(() => {
    onAssigneeChangeRef.current = onAssigneeChange;
  }, [onAssigneeChange]);

  useEffect(() => {
    let isMounted = true;
    if (projectId) {
      fetchProjectMembersForForm(projectId)
        .then((mapped) => {
          if (!isMounted) return;
          setCurrentMembers(mapped);

          const latestAssigneeId = assigneeIdRef.current;
          if (
            latestAssigneeId &&
            !lockAssignee &&
            !mapped.some((m) => m.id === latestAssigneeId)
          ) {
            onAssigneeChangeRef.current(null);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch project members:', err);
        });
    } else {
      setCurrentMembers(projectMembers);

      const latestAssigneeId = assigneeIdRef.current;
      if (
        latestAssigneeId &&
        !lockAssignee &&
        !projectMembers.some((m) => m.id === latestAssigneeId)
      ) {
        onAssigneeChangeRef.current(null);
      }
    }
    return () => {
      isMounted = false;
    };
  }, [projectId, projectMembers, lockAssignee]);

  return currentMembers;
}
