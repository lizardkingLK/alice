'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, HelpCircle } from '@repo/ui/lib/icons';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';

import { useBacklogCapacityDisplay } from '@/app/backlog/_components/backlog-capacity-display-menu';
import { useBacklogLayout } from '@/app/backlog/_components/backlog-layout-menu';
import { BacklogToolbar } from '@/app/backlog/_components/backlog-toolbar';
import { useBacklogProjectDefaults } from '@/app/backlog/_hooks/use-backlog-project-defaults';
import { buildAppliedFilterBadgeItems } from '@/components/applied-filter-badges.model';
import {
  PRIORITY_LABELS,
  type WorkItemPriority,
} from '@/app/work-items/_helpers/work-item-priority-ui';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { BacklogSprintCard } from '@/app/backlog/_components/backlog-sprint-card';
import { BacklogPanel } from '@/app/backlog/_components/backlog-panel';
import { BacklogItemDetailsSheet } from '@/app/backlog/_components/backlog-item-details-sheet';
import {
  BacklogCompleteSprintDialog,
  BacklogCreateIssueDialog,
  BacklogCreateSprintDialog,
  BacklogEditSprintDialog,
  BacklogMismatchDialog,
  BacklogStartSprintDialog,
  BacklogErrorDialog,
  type BacklogMismatchReason,
} from '@/app/backlog/_components/backlog-dialogs';
import {
  getBacklogIssuesPaneClass,
  getBacklogLayoutContainerClass,
  getBacklogSprintsPaneClass,
} from '@/app/backlog/_helpers/backlog-layout-storage';
import {
  enrichWorkItemsWithMemberAvatars,
  filterBacklogDisplayedSprints,
  getFormDataStringValue,
  mapPriority,
  type BacklogActiveTab,
  type BacklogAssignee,
} from '@/app/backlog/_helpers/backlog-item-utils';
import type { ProjectTeamMemberCapacity } from '@/app/backlog/_helpers/backlog-sprint-capacity';
import { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { collectLocalDescendantIds } from '@/app/work-items/_helpers/work-item-descendant-ids';
import { mergeWorkItemServerRow } from '@/app/work-items/_helpers/work-item-merge-server-row';
import { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { updateSprintStatusWithOptimisticLock } from '@/app/sprints/_helpers/update-sprint-status-with-lock';
import { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import { User as DbUser } from '@/app/users/_services/users.mutations.client';
import { updateWorkItem } from '@/app/work-items/_services/work-items.mutations.client';
import { resolveWorkItemMember } from '@/app/work-items/_helpers/work-item-member';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutation } from '@/lib/optimistic-lock/run-locked-mutation';
import {
  isBoardMoveOptimisticLockError,
  readBoardMoveConflictServerRow,
  toastWorkItemDnDConflict,
} from '@/app/board/_helpers/board-move-conflict-toast';
import {
  applyRealtimeWorkItemRow,
  mergeWorkItemRealtimeRow,
} from '@/lib/work-items/apply-realtime-work-item-row';
import { useWorkItemsRealtime } from '@/lib/work-items/use-work-items-realtime';
import { afterDialogClose } from '@/lib/dialog-close';

const SPRINT_PLACEMENT_FIELDS = ['sprint_id', 'updated_by'] as const;

const BACKLOG_CONFLICT_TITLE = 'Someone else moved this item';
const BACKLOG_CONFLICT_DESCRIPTION =
  'The backlog was updated to the latest sprint assignment.';

function sameWorkItemSprintId(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return (a ?? null) === (b ?? null);
}

function restoreSprintIdsFromMap(
  previousById: ReadonlyMap<string, string | null | undefined>,
  items: readonly DbWorkItem[]
): DbWorkItem[] {
  return items.map((item) => {
    const previous = previousById.get(item.id);
    return previous === undefined ? item : { ...item, sprint_id: previous };
  });
}

function applySprintIdsToItems(
  items: readonly DbWorkItem[],
  ids: readonly string[],
  sprintId: string | null
): DbWorkItem[] {
  if (ids.length === 0) {
    return [...items];
  }
  const idSet = new Set(ids);
  return items.map((item) =>
    idSet.has(item.id) ? { ...item, sprint_id: sprintId } : item
  );
}

interface BacklogWorkspaceProps {
  projects: DbProject[];
  projectMembers: DbUser[];
  teamCapacities: readonly ProjectTeamMemberCapacity[];
  initialWorkItems: DbWorkItem[];
  sprints: Sprint[];
  userRole: string;
  currentUserId?: string | null;
  error?: string | null;
}

export function BacklogWorkspace({
  projects,
  projectMembers,
  teamCapacities,
  initialWorkItems,
  sprints,
  userRole,
  currentUserId,
  error = null,
}: Readonly<BacklogWorkspaceProps>) {
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';
  const { handleMutationError } = useOptimisticLock();

  const updateSprintStatusWithLock = async (
    sprint: Sprint,
    status: Sprint['status']
  ) =>
    updateSprintStatusWithOptimisticLock({
      sprint,
      status,
      handleMutationError,
      currentUserId,
    });

  // Client state
  const [sprintList, setSprintList] = useState<Sprint[]>(sprints);
  const [workItems, setWorkItems] = useState<DbWorkItem[]>(() =>
    enrichWorkItemsWithMemberAvatars(initialWorkItems, projectMembers)
  );

  useEffect(() => {
    setSprintList(sprints);
  }, [sprints]);

  useEffect(() => {
    setWorkItems(
      enrichWorkItemsWithMemberAvatars(initialWorkItems, projectMembers)
    );
  }, [initialWorkItems, projectMembers]);

  // Active Tab: active sprints & backlog vs completed sprints
  const [activeTab, setActiveTab] = useState<BacklogActiveTab>('active');
  const showBacklogPane = activeTab === 'active';
  const { preferredLayout, effectiveLayout, setPreferredLayout } =
    useBacklogLayout(currentUserId, showBacklogPane);
  const { capacityDisplay, setCapacityDisplay } =
    useBacklogCapacityDisplay(currentUserId);

  const backlogDefaults = useBacklogProjectDefaults({
    userId: currentUserId ?? null,
    projects,
    sprints: sprintList,
  });
  const {
    projectFilter,
    setProjectFilter,
    sprintFilter,
    setSprintFilter,
    saveDefaults,
  } = backlogDefaults;

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Interactive UI state
  const [collapsedSprints, setCollapsedSprints] = useState<
    Record<string, boolean>
  >({});
  const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null); // sprint ID or 'backlog'
  const [pendingSprintMoveIds, setPendingSprintMoveIds] = useState<Set<string>>(
    () => new Set()
  );

  // Selection state for Slide-out Details panel
  const [selectedItem, setSelectedItem] = useState<DbWorkItem | null>(null);

  // Dialogs State
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [createIssueSprintId, setCreateIssueSprintId] = useState<string | null>(
    null
  );
  const [sprintToStart, setSprintToStart] = useState<Sprint | null>(null);
  const [sprintToComplete, setSprintToComplete] = useState<Sprint | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isMismatchOpen, setIsMismatchOpen] = useState(false);
  const [mismatchReason, setMismatchReason] =
    useState<BacklogMismatchReason | null>(null);
  const [isErrorOpen, setIsErrorOpen] = useState(false);

  useEffect(() => {
    if (isMismatchOpen) {
      return;
    }
    return afterDialogClose(() => {
      setMismatchReason(null);
    });
  }, [isMismatchOpen]);

  const openMismatchDialog = (reason: BacklogMismatchReason) => {
    setMismatchReason(reason);
    setIsMismatchOpen(true);
  };

  const getSprintDropMismatchReason = (
    itemId: string | null,
    targetSprintId: string | null
  ): BacklogMismatchReason | null => {
    if (!itemId) {
      return null;
    }
    const draggedItem = workItems.find((item) => item.id === itemId);
    if (!draggedItem) {
      return null;
    }

    if (draggedItem.parent_id) {
      const parent = workItems.find(
        (item) => item.id === draggedItem.parent_id
      );
      const parentSprintId = parent?.sprint_id ?? null;
      const nextSprintId = targetSprintId || null;
      if (!sameWorkItemSprintId(parentSprintId, nextSprintId)) {
        return 'parent-sprint';
      }
    }

    if (!targetSprintId) {
      return null;
    }

    const targetSprint = sprintList.find(
      (sprint) => sprint.id === targetSprintId
    );
    const sprintProjId = targetSprint?.project?.id;
    if (sprintProjId && draggedItem.project_id !== sprintProjId) {
      return 'project';
    }
    return null;
  };

  const restoreWorkItemAfterFailedMutation = (
    itemId: string,
    patch: Partial<DbWorkItem>,
    fallbackMessage: string,
    error: unknown
  ) => {
    setWorkItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
    setSelectedItem((prev) =>
      prev?.id === itemId ? { ...prev, ...patch } : prev
    );
    setActionError(error instanceof Error ? error.message : fallbackMessage);
    setIsErrorOpen(true);
    // Log message only — logging the Error object triggers Next.js' console
    // error overlay in development even when the dialog handles it.
    console.error(
      'error. failed to update work item:',
      error instanceof Error ? error.message : fallbackMessage
    );
  };

  /** Keep lock token + fields aligned with the server after a successful write. */
  const syncWorkItemFromServer = (id: string, updated: DbWorkItem) => {
    setWorkItems((previous) =>
      previous.map((item) =>
        item.id === id ? mergeWorkItemServerRow(item, updated) : item
      )
    );
    setSelectedItem((previous) =>
      previous?.id === id ? mergeWorkItemServerRow(previous, updated) : previous
    );
  };

  const applySprintRealtimeRow = useCallback(
    (row: Partial<DbWorkItem> & { id: string }, force = false) => {
      setWorkItems((previous) => {
        if (force) {
          const index = previous.findIndex((item) => item.id === row.id);
          if (index < 0) {
            return previous;
          }
          const next = [...previous];
          next[index] = mergeWorkItemRealtimeRow(
            previous[index]!,
            row,
            SPRINT_PLACEMENT_FIELDS
          );
          return next;
        }
        return (
          applyRealtimeWorkItemRow(previous, row, SPRINT_PLACEMENT_FIELDS) ??
          previous
        );
      });
      setSelectedItem((previous) => {
        if (!previous || previous.id !== row.id) {
          return previous;
        }
        return mergeWorkItemRealtimeRow(previous, row, SPRINT_PLACEMENT_FIELDS);
      });
      setPendingSprintMoveIds((previous) => {
        if (!previous.has(row.id)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(row.id);
        return next;
      });
    },
    []
  );

  useWorkItemsRealtime({
    enabled: Boolean(currentUserId),
    channelPrefix: 'backlog-work-items',
    projectId: projectFilter !== 'all' ? projectFilter : null,
    onRow: applySprintRealtimeRow,
  });

  // Helper: Drag-and-Drop Handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    if (pendingSprintMoveIds.has(itemId)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    const id = targetId || 'backlog';

    if (getSprintDropMismatchReason(draggedItemId, targetId)) {
      return;
    }

    if (dragOverTargetId !== id) {
      setDragOverTargetId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (itemId) {
      if (pendingSprintMoveIds.has(itemId)) {
        setDraggedItemId(null);
        setDragOverTargetId(null);
        return;
      }
      const dropMismatch = getSprintDropMismatchReason(itemId, targetId);
      if (dropMismatch) {
        openMismatchDialog(dropMismatch);
        setDraggedItemId(null);
        setDragOverTargetId(null);
        return;
      }

      const draggedItem = workItems.find((item) => item.id === itemId);
      const cascadeIds =
        draggedItem && !draggedItem.parent_id
          ? collectLocalDescendantIds(itemId, workItems)
          : [];
      const affectedIds = new Set([itemId, ...cascadeIds]);

      setWorkItems((prev) =>
        prev.map((item) =>
          affectedIds.has(item.id) ? { ...item, sprint_id: targetId } : item
        )
      );
      if (selectedItem && affectedIds.has(selectedItem.id)) {
        setSelectedItem((prev) =>
          prev ? { ...prev, sprint_id: targetId } : null
        );
      }
      const formData = new FormData();
      formData.append('sprint_id', targetId || '');
      if (draggedItem) {
        const previousById = new Map(
          workItems
            .filter((item) => affectedIds.has(item.id))
            .map((item) => [item.id, item.sprint_id] as const)
        );
        const expectedUpdatedAt = draggedItem.updated_at;
        setPendingSprintMoveIds((previous) => new Set(previous).add(itemId));

        const revertSprintMove = () => {
          setWorkItems((prev) => restoreSprintIdsFromMap(previousById, prev));
          setSelectedItem((prev) => {
            if (!prev) {
              return prev;
            }
            const restored = restoreSprintIdsFromMap(previousById, [prev]);
            return restored[0] ?? prev;
          });
        };

        updateWorkItem(itemId, formData, expectedUpdatedAt)
          .then((response) => {
            if (response.error || !response.data) {
              revertSprintMove();
              setActionError(
                typeof response.error === 'string'
                  ? response.error
                  : 'Failed to update work item sprint.'
              );
              setIsErrorOpen(true);
              return;
            }
            const updated = response.data;
            const serverCascade =
              response.cascadedSprintDescendantIds ?? cascadeIds;
            syncWorkItemFromServer(itemId, updated);
            const nextSprintId = updated.sprint_id ?? targetId;
            setWorkItems((prev) =>
              applySprintIdsToItems(prev, serverCascade, nextSprintId)
            );
          })
          .catch((error: unknown) => {
            if (isBoardMoveOptimisticLockError(error)) {
              toastWorkItemDnDConflict(
                BACKLOG_CONFLICT_TITLE,
                BACKLOG_CONFLICT_DESCRIPTION
              );
              const serverRow = readBoardMoveConflictServerRow(error);
              revertSprintMove();
              if (serverRow) {
                applySprintRealtimeRow(serverRow, true);
              }
              return;
            }
            revertSprintMove();
            setActionError(
              error instanceof Error
                ? error.message
                : 'Failed to update work item sprint.'
            );
            setIsErrorOpen(true);
          })
          .finally(() => {
            setPendingSprintMoveIds((previous) => {
              const next = new Set(previous);
              next.delete(itemId);
              return next;
            });
          });
      }
    }
    setDraggedItemId(null);
    setDragOverTargetId(null);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return workItems.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject =
        projectFilter === 'all' || item.project_id === projectFilter;
      const matchesAssignee =
        assigneeFilter === 'all' || item.assignee_id === assigneeFilter;

      const mappedPriority = mapPriority(item.priority);
      const matchesPriority =
        priorityFilter === 'all' || mappedPriority === priorityFilter;

      return (
        matchesSearch && matchesProject && matchesAssignee && matchesPriority
      );
    });
  }, [workItems, searchQuery, projectFilter, assigneeFilter, priorityFilter]);

  // Backlog items (sprint_id is null)
  const backlogItems = useMemo(() => {
    return filteredItems.filter((item) => !item.sprint_id);
  }, [filteredItems]);

  // Group filtered work items by sprint
  const itemsBySprint = useMemo(() => {
    const groups: Record<string, DbWorkItem[]> = {};
    filteredItems.forEach((item) => {
      const sId = item.sprint_id;
      if (sId) {
        groups[sId] ??= [];
        groups[sId].push(item);
      }
    });
    return groups;
  }, [filteredItems]);

  // Issue counts reflect the current filters (search, project, assignee, priority)
  const sprintStats = useMemo(() => {
    const stats: Record<string, { count: number }> = {};

    sprintList.forEach((sprint) => {
      stats[sprint.id] = {
        count: (itemsBySprint[sprint.id] ?? []).length,
      };
    });

    stats.backlog = { count: backlogItems.length };

    return stats;
  }, [sprintList, itemsBySprint, backlogItems.length]);

  // Filter sprints by tab, project, and optional default sprint
  const displayedSprints = useMemo(
    () =>
      filterBacklogDisplayedSprints({
        sprints: sprintList,
        activeTab,
        projectFilter,
        sprintFilter,
        getStatus: (sprint) => sprint.status,
        getProjectId: (sprint) => sprint.project?.id,
      }),
    [sprintList, activeTab, projectFilter, sprintFilter]
  );

  // Start Sprint Handler
  const handleStartSprint = (sprintId: string) => {
    if (!isManagerOrAdmin) return;
    const sprint = sprintList.find((s) => s.id === sprintId);
    if (sprint) {
      setActionError(null);
      setSprintToStart(sprint);
    }
  };

  // Complete Sprint Handler
  const handleCompleteSprint = (sprintId: string) => {
    if (!isManagerOrAdmin) return;
    const sprint = sprintList.find((s) => s.id === sprintId);
    if (sprint) {
      setActionError(null);
      setSprintToComplete(sprint);
    }
  };

  // Start / complete sprint (shared pending + lock + list update path)
  const confirmSprintStatusChange = async (
    sprintId: string,
    status: 'active' | 'closed',
    options: {
      readonly actionLabel: string;
      readonly clearDialog: () => void;
      readonly afterSuccess?: () => void;
    }
  ) => {
    if (!isManagerOrAdmin) {
      setActionError('Only admins and managers can perform this action.');
      return;
    }
    const sprint = sprintList.find((entry) => entry.id === sprintId);
    if (!sprint) {
      setActionError('Sprint not found.');
      return;
    }
    setActionError(null);
    setIsActionPending(true);
    try {
      const updatedSprint = await updateSprintStatusWithLock(sprint, status);
      if (!updatedSprint) {
        return;
      }
      setSprintList((prev) =>
        prev.map((s) => (s.id === sprintId ? updatedSprint : s))
      );
      options.afterSuccess?.();
      options.clearDialog();
    } catch (err) {
      console.error(`Failed to ${options.actionLabel} sprint:`, err);
      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to ${options.actionLabel} sprint.`
      );
    } finally {
      setIsActionPending(false);
    }
  };

  const confirmStartSprint = async (sprintId: string) => {
    await confirmSprintStatusChange(sprintId, 'active', {
      actionLabel: 'start',
      clearDialog: () => setSprintToStart(null),
    });
  };

  const clearIncompleteItemsFromSprint = (sprintId: string) => {
    setWorkItems((prev) =>
      prev.map((item) =>
        item.sprint_id === sprintId && item.status !== 'Done'
          ? { ...item, sprint_id: null }
          : item
      )
    );
  };

  const confirmCompleteSprint = async (sprintId: string) => {
    await confirmSprintStatusChange(sprintId, 'closed', {
      actionLabel: 'complete',
      clearDialog: () => setSprintToComplete(null),
      afterSuccess: () => clearIncompleteItemsFromSprint(sprintId),
    });
  };

  // Toggle Collapse
  const toggleSprint = (sprintId: string) => {
    setCollapsedSprints((prev) => ({
      ...prev,
      [sprintId]: !prev[sprintId],
    }));
  };

  // Dialog Create Sprint Submission
  const handleCreateSprintSuccess = (newSprint: Sprint) => {
    if (!isManagerOrAdmin) return;
    setSprintList((prev) => [newSprint, ...prev]);
    setIsCreateSprintOpen(false);
  };

  const handleEditSprintSuccess = (updatedSprint: Sprint) => {
    if (!isManagerOrAdmin) return;
    setSprintList((prev) =>
      prev.map((sprint) =>
        sprint.id === updatedSprint.id ? updatedSprint : sprint
      )
    );
    setEditingSprint(null);
  };

  const openCreateIssue = (sprintId: string | null = null) => {
    setCreateIssueSprintId(sprintId);
    setIsCreateIssueOpen(true);
  };

  const closeCreateIssue = () => {
    setIsCreateIssueOpen(false);
    setCreateIssueSprintId(null);
  };

  // Dialog Create Issue Submission
  const handleCreateIssueSuccess = (newWI: DbWorkItem) => {
    setWorkItems((prev) => [newWI, ...prev]);
    closeCreateIssue();
  };

  const createIssueProjects = useMemo(() => {
    if (!createIssueSprintId) {
      return projects;
    }
    const sprint = sprintList.find((entry) => entry.id === createIssueSprintId);
    const projectId = sprint?.project?.id;
    if (!projectId) {
      return projects;
    }
    const matched = projects.filter((project) => project.id === projectId);
    return matched.length > 0 ? matched : projects;
  }, [createIssueSprintId, projects, sprintList]);

  const lockCreateIssueProject =
    Boolean(createIssueSprintId) && createIssueProjects.length === 1;

  const createSprintDefaultProjectId = useMemo(() => {
    if (projectFilter !== 'all') {
      return projectFilter;
    }
    return undefined;
  }, [projectFilter]);

  const isProjectSprintMismatch = (
    currentItem: DbWorkItem | undefined,
    sprint: Sprint | undefined,
    projectId: string | undefined
  ): boolean => {
    if (!currentItem || !sprint) {
      return false;
    }
    const sprintProjId = sprint.project?.id;
    return !!(sprintProjId && projectId !== sprintProjId);
  };

  const checkProjectMismatch = (
    currentItem: DbWorkItem | undefined,
    newProjectId: unknown
  ): boolean => {
    if (!currentItem?.sprint_id) {
      return false;
    }
    const currentSprint = sprintList.find(
      (s) => s.id === currentItem.sprint_id
    );
    return isProjectSprintMismatch(
      currentItem,
      currentSprint,
      String(newProjectId)
    );
  };

  const checkSprintMismatch = (
    currentItem: DbWorkItem | undefined,
    newSprintId: unknown
  ): boolean => {
    if (!newSprintId) {
      return false;
    }
    const targetSprint = sprintList.find((s) => s.id === newSprintId);
    return isProjectSprintMismatch(
      currentItem,
      targetSprint,
      currentItem?.project_id
    );
  };

  const checkProjectSprintMismatch = (
    itemId: string,
    field: string,
    value: unknown
  ): boolean => {
    const currentItem = workItems.find((item) => item.id === itemId);
    if (field === 'project_id') {
      return checkProjectMismatch(currentItem, value);
    }
    if (field === 'sprint_id') {
      return checkSprintMismatch(currentItem, value);
    }
    return false;
  };

  const getUpdatedAssignee = (
    field: string,
    value: unknown
  ): BacklogAssignee | null => {
    if (field !== 'assignee_id') {
      return null;
    }
    return resolveWorkItemMember(
      projectMembers,
      typeof value === 'string' ? value : null
    ) as BacklogAssignee | null;
  };

  const applyLocalFieldUpdates = (
    item: DbWorkItem,
    updates: Partial<DbWorkItem>
  ): DbWorkItem => {
    const updatedItem = { ...item, ...updates };
    if ('assignee_id' in updates) {
      updatedItem.assignee = getUpdatedAssignee(
        'assignee_id',
        updates.assignee_id
      );
    }
    return updatedItem;
  };

  // Update multiple inline values of item from details sheet
  const handleUpdateItemFields = (
    itemId: string,
    updates: Partial<DbWorkItem>
  ) => {
    // Check sprint project mismatch if sprint_id or project_id is updated
    for (const [field, value] of Object.entries(updates)) {
      if (checkProjectSprintMismatch(itemId, field, value)) {
        openMismatchDialog('project');
        return;
      }
    }

    const targetItem = workItems.find((item) => item.id === itemId);
    const sprintCascadeIds =
      targetItem && !targetItem.parent_id && Object.hasOwn(updates, 'sprint_id')
        ? collectLocalDescendantIds(itemId, workItems)
        : [];
    const sprintAffectedIds = new Set([itemId, ...sprintCascadeIds]);

    // Apply all updates to local state (cascade sprint to descendants)
    setWorkItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return applyLocalFieldUpdates(item, updates);
        }
        if (sprintCascadeIds.includes(item.id) && 'sprint_id' in updates) {
          return { ...item, sprint_id: updates.sprint_id ?? null };
        }
        return item;
      })
    );

    // Sync selected item state
    setSelectedItem((prev) => {
      if (!prev || !sprintAffectedIds.has(prev.id)) {
        return prev;
      }
      if (prev.id === itemId) {
        return applyLocalFieldUpdates(prev, updates);
      }
      if ('sprint_id' in updates) {
        return { ...prev, sprint_id: updates.sprint_id ?? null };
      }
      return prev;
    });

    const formData = new FormData();
    for (const [key, value] of Object.entries(updates)) {
      formData.append(key, getFormDataStringValue(value));
    }

    if (targetItem) {
      const expectedUpdatedAt = targetItem.updated_at;
      const previousValues = Object.fromEntries(
        Object.keys(updates).map((key) => [
          key,
          targetItem[key as keyof typeof targetItem],
        ])
      ) as Partial<DbWorkItem>;
      const previousSprintByDescendant = new Map(
        sprintCascadeIds.map((id) => {
          const row = workItems.find((item) => item.id === id);
          return [id, row?.sprint_id ?? null] as const;
        })
      );
      runLockedMutation({
        mutate: () => updateWorkItem(itemId, formData, expectedUpdatedAt),
        handleMutationError,
        entityType: 'work_item',
        entityId: itemId,
        expectedUpdatedAt,
        pendingFields: updates as Record<string, unknown>,
        currentUserId,
      })
        .then((result) => {
          if (result.ok) {
            const updated = result.data.data;
            if (updated) {
              syncWorkItemFromServer(itemId, updated);
            }
            const serverCascade =
              result.data.cascadedSprintDescendantIds ?? sprintCascadeIds;
            if ('sprint_id' in updates && serverCascade.length > 0) {
              const nextSprintId = updated?.sprint_id ?? updates.sprint_id;
              setWorkItems((prev) =>
                applySprintIdsToItems(prev, serverCascade, nextSprintId ?? null)
              );
            }
            return;
          }
          if (!result.conflict) {
            if (previousSprintByDescendant.size > 0) {
              setWorkItems((prev) =>
                restoreSprintIdsFromMap(previousSprintByDescendant, prev)
              );
            }
            restoreWorkItemAfterFailedMutation(
              itemId,
              previousValues,
              `Failed to update work item ${itemId}.`,
              result.error
            );
          }
        })
        .catch((error: unknown) => {
          if (previousSprintByDescendant.size > 0) {
            setWorkItems((prev) =>
              restoreSprintIdsFromMap(previousSprintByDescendant, prev)
            );
          }
          restoreWorkItemAfterFailedMutation(
            itemId,
            previousValues,
            `Failed to update work item ${itemId}.`,
            error
          );
        });
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setProjectFilter('all');
    setAssigneeFilter('all');
    setPriorityFilter('all');
  };

  const isFiltersActive = Boolean(
    searchQuery ||
    assigneeFilter !== 'all' ||
    priorityFilter !== 'all' ||
    projectFilter !== 'all' ||
    Boolean(sprintFilter)
  );

  const appliedFilterItems = useMemo(
    () =>
      buildAppliedFilterBadgeItems({
        search: searchQuery,
        project:
          projectFilter !== 'all'
            ? {
                id: projectFilter,
                name:
                  projects.find((project) => project.id === projectFilter)
                    ?.name ?? projectFilter,
              }
            : null,
        sprint: sprintFilter
          ? {
              id: sprintFilter,
              name:
                sprintList.find((sprint) => sprint.id === sprintFilter)?.name ??
                sprintFilter,
            }
          : null,
        assignee:
          assigneeFilter !== 'all'
            ? {
                id: assigneeFilter,
                name:
                  projectMembers.find((member) => member.id === assigneeFilter)
                    ?.name ?? assigneeFilter,
              }
            : null,
        priority:
          priorityFilter !== 'all'
            ? {
                id: priorityFilter,
                name:
                  PRIORITY_LABELS[priorityFilter as WorkItemPriority] ??
                  formatLabelWithSpace(priorityFilter),
              }
            : null,
      }),
    [
      assigneeFilter,
      priorityFilter,
      projectFilter,
      projectMembers,
      projects,
      searchQuery,
      sprintFilter,
      sprintList,
    ]
  );

  const handleRemoveAppliedFilter = (chipIds: readonly string[]) => {
    for (const chipId of chipIds) {
      if (chipId === 'search') {
        setSearchQuery('');
        continue;
      }
      if (chipId === 'assignee') {
        setAssigneeFilter('all');
        continue;
      }
      if (chipId === 'priority') {
        setPriorityFilter('all');
        continue;
      }
      if (chipId === 'project') {
        setProjectFilter('all');
        continue;
      }
      if (chipId === 'sprint') {
        setSprintFilter('');
      }
    }
  };

  // Derived counts for the sprint confirmation dialogs
  const startSprintItems = sprintToStart
    ? workItems.filter((item) => item.sprint_id === sprintToStart.id)
    : [];
  const completeSprintItems = sprintToComplete
    ? workItems.filter((item) => item.sprint_id === sprintToComplete.id)
    : [];
  const completeSprintIncompleteCount = completeSprintItems.filter(
    (item) => item.status !== 'Done'
  ).length;

  const filteredProjectName =
    projectFilter === 'all'
      ? null
      : projects.find((project) => project.id === projectFilter)?.name;

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-6 pb-10">
        {/* Error alert */}
        {error && (
          <div className="bg-destructive/15 border-destructive/20 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Toolbar & Filters */}
        <BacklogToolbar
          projects={projects}
          sprints={sprintList}
          projectMembers={projectMembers}
          isManagerOrAdmin={isManagerOrAdmin}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          preferredLayout={preferredLayout}
          onLayoutChange={setPreferredLayout}
          capacityDisplay={capacityDisplay}
          onCapacityDisplayChange={setCapacityDisplay}
          onCreateSprint={() => setIsCreateSprintOpen(true)}
          onCreateIssue={() => openCreateIssue(null)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          sprintFilter={sprintFilter}
          onSprintFilterChange={setSprintFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          isFiltersActive={isFiltersActive}
          appliedFilterItems={appliedFilterItems}
          onRemoveAppliedFilter={handleRemoveAppliedFilter}
          onClearFilters={handleClearFilters}
          onSaveWorkspaceDefaults={currentUserId ? saveDefaults : undefined}
        />

        {/* Sprints & Backlog Containers */}
        <div className={getBacklogLayoutContainerClass(effectiveLayout)}>
          <div className={getBacklogSprintsPaneClass(effectiveLayout)}>
            {displayedSprints.length === 0 ? (
              <div className="bg-card/35 border-border text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center text-sm">
                <HelpCircle className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
                <p className="font-medium">No {activeTab} sprints found</p>
                <p className="text-muted-foreground/75 mt-1 text-xs">
                  {filteredProjectName
                    ? `No ${activeTab} sprints for ${filteredProjectName}. Try another project or clear filters.`
                    : 'Create a sprint to organize upcoming deliverable workflows.'}
                </p>
              </div>
            ) : (
              displayedSprints.map((sprint) => (
                <BacklogSprintCard
                  key={sprint.id}
                  sprint={sprint}
                  items={itemsBySprint[sprint.id] || []}
                  issueCount={(sprintStats[sprint.id] || { count: 0 }).count}
                  isCollapsed={!!collapsedSprints[sprint.id]}
                  isDragOver={dragOverTargetId === sprint.id}
                  isManagerOrAdmin={isManagerOrAdmin}
                  projects={projects}
                  projectMembers={projectMembers}
                  teamCapacities={teamCapacities}
                  capacityDisplay={capacityDisplay}
                  onToggle={toggleSprint}
                  onCreateIssue={openCreateIssue}
                  onEditSprint={setEditingSprint}
                  onStartSprint={handleStartSprint}
                  onCompleteSprint={handleCompleteSprint}
                  onSelectItem={setSelectedItem}
                  onItemDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              ))
            )}
          </div>

          {/* Backlog Section (Only visible on Active Tab) */}
          {showBacklogPane && (
            <div className={getBacklogIssuesPaneClass(effectiveLayout)}>
              <BacklogPanel
                items={backlogItems}
                projects={projects}
                projectMembers={projectMembers}
                isCollapsed={isBacklogCollapsed}
                isDragOver={dragOverTargetId === 'backlog'}
                onToggle={() => setIsBacklogCollapsed(!isBacklogCollapsed)}
                onCreateIssue={() => openCreateIssue(null)}
                onSelectItem={setSelectedItem}
                onItemDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            </div>
          )}
        </div>

        {/* Slide-out details panel */}
        <BacklogItemDetailsSheet
          item={selectedItem}
          projects={projects}
          projectMembers={projectMembers}
          sprints={sprintList}
          blockOutsideClose={isMismatchOpen}
          onClose={() => setSelectedItem(null)}
          onUpdateFields={handleUpdateItemFields}
        />

        {/* Dialog: Create Sprint */}
        {isManagerOrAdmin && (
          <BacklogCreateSprintDialog
            open={isCreateSprintOpen}
            projects={projects}
            currentUserId={currentUserId}
            defaultProjectId={createSprintDefaultProjectId}
            onClose={() => setIsCreateSprintOpen(false)}
            onCreated={handleCreateSprintSuccess}
          />
        )}

        {/* Dialog: Edit Sprint */}
        {isManagerOrAdmin && (
          <BacklogEditSprintDialog
            sprint={editingSprint}
            projects={projects}
            currentUserId={currentUserId}
            onClose={() => setEditingSprint(null)}
            onUpdated={handleEditSprintSuccess}
          />
        )}

        {/* Dialog: Create Issue */}
        <BacklogCreateIssueDialog
          open={isCreateIssueOpen}
          projects={createIssueProjects}
          projectMembers={projectMembers}
          defaultSprintId={createIssueSprintId}
          lockProject={lockCreateIssueProject}
          onOpenChange={(open) => {
            if (open) {
              setIsCreateIssueOpen(true);
              return;
            }
            closeCreateIssue();
          }}
          onClose={closeCreateIssue}
          onCreated={handleCreateIssueSuccess}
        />

        {/* Dialog: Start Sprint Confirmation */}
        <BacklogStartSprintDialog
          sprint={sprintToStart}
          itemCount={startSprintItems.length}
          actionError={actionError}
          isPending={isActionPending}
          onOpenChange={(open) => !open && setSprintToStart(null)}
          onConfirm={confirmStartSprint}
        />

        {/* Dialog: Complete Sprint Confirmation */}
        <BacklogCompleteSprintDialog
          sprint={sprintToComplete}
          itemCount={completeSprintItems.length}
          incompleteCount={completeSprintIncompleteCount}
          actionError={actionError}
          isPending={isActionPending}
          onOpenChange={(open) => !open && setSprintToComplete(null)}
          onConfirm={confirmCompleteSprint}
        />

        {/* Dialog: Sprint assignment mismatch */}
        <BacklogMismatchDialog
          open={isMismatchOpen}
          reason={mismatchReason}
          onOpenChange={setIsMismatchOpen}
          onAcknowledge={() => setIsMismatchOpen(false)}
        />

        <BacklogErrorDialog
          open={isErrorOpen}
          error={actionError}
          onOpenChange={setIsErrorOpen}
          onClose={() => {
            setIsErrorOpen(false);
            setActionError(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
