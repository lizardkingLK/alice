'use client';

import React, { useState, useMemo } from 'react';
import { AlertCircle, HelpCircle } from '@repo/ui/lib/icons';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';

import { useBacklogLayout } from '@/app/backlog/_components/backlog-layout-menu';
import { BacklogToolbar } from '@/app/backlog/_components/backlog-toolbar';
import { BacklogSprintCard } from '@/app/backlog/_components/backlog-sprint-card';
import { BacklogPanel } from '@/app/backlog/_components/backlog-panel';
import { BacklogItemDetailsSheet } from '@/app/backlog/_components/backlog-item-details-sheet';
import {
  BacklogCompleteSprintDialog,
  BacklogCreateIssueDialog,
  BacklogCreateSprintDialog,
  BacklogMismatchDialog,
  BacklogStartSprintDialog,
} from '@/app/backlog/_components/backlog-dialogs';
import {
  getBacklogIssuesPaneClass,
  getBacklogLayoutContainerClass,
  getBacklogSprintsPaneClass,
} from '@/app/backlog/_helpers/backlog-layout-storage';
import {
  getFormDataStringValue,
  mapPriority,
  type BacklogActiveTab,
  type BacklogAssignee,
} from '@/app/backlog/_helpers/backlog-item-utils';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import {
  Sprint,
  updateSprintStatus,
} from '@/app/sprints/_services/sprints.service';
import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { User as DbUser } from '@/app/users/_services/users.service';
import { updateWorkItem } from '@/app/work-items/_services/workItem.service.client';

interface BacklogWorkspaceProps {
  projects: DbProject[];
  projectMembers: DbUser[];
  initialWorkItems: DbWorkItem[];
  sprints: Sprint[];
  userRole: string;
  currentUserId?: string | null;
  error?: string | null;
}

export function BacklogWorkspace({
  projects,
  projectMembers,
  initialWorkItems,
  sprints,
  userRole,
  currentUserId,
  error = null,
}: Readonly<BacklogWorkspaceProps>) {
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  // Client state
  const [sprintList, setSprintList] = useState<Sprint[]>(sprints);
  const [workItems, setWorkItems] = useState<DbWorkItem[]>(initialWorkItems);

  // Active Tab: active sprints & backlog vs completed sprints
  const [activeTab, setActiveTab] = useState<BacklogActiveTab>('active');
  const showBacklogPane = activeTab === 'active';
  const { preferredLayout, effectiveLayout, setPreferredLayout } =
    useBacklogLayout(currentUserId, showBacklogPane);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Interactive UI state
  const [collapsedSprints, setCollapsedSprints] = useState<
    Record<string, boolean>
  >({});
  const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null); // sprint ID or 'backlog'

  // Selection state for Slide-out Details panel
  const [selectedItem, setSelectedItem] = useState<DbWorkItem | null>(null);

  // Dialogs State
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [sprintToStart, setSprintToStart] = useState<Sprint | null>(null);
  const [sprintToComplete, setSprintToComplete] = useState<Sprint | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isMismatchOpen, setIsMismatchOpen] = useState(false);

  // Helper: Drag-and-Drop Handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    const id = targetId || 'backlog';

    // Validate project matches if target is a sprint
    if (targetId && draggedItemId) {
      const draggedItem = workItems.find((item) => item.id === draggedItemId);
      const targetSprint = sprintList.find((s) => s.id === targetId);
      if (draggedItem && targetSprint) {
        const sprintProjId = targetSprint.project?.id;
        if (sprintProjId && draggedItem.project_id !== sprintProjId) {
          // Project mismatch: do not set as drag-over target (suppress drop highlight)
          return;
        }
      }
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
      // Validate project matches if target is a sprint
      if (targetId) {
        const draggedItem = workItems.find((item) => item.id === itemId);
        const targetSprint = sprintList.find((s) => s.id === targetId);
        if (draggedItem && targetSprint) {
          const sprintProjId = targetSprint.project?.id;
          if (sprintProjId && draggedItem.project_id !== sprintProjId) {
            setIsMismatchOpen(true);
            setDraggedItemId(null);
            setDragOverTargetId(null);
            return;
          }
        }
      }

      setWorkItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, sprint_id: targetId } : item
        )
      );
      // Update selected item in sheet if it's currently open
      if (selectedItem?.id === itemId) {
        setSelectedItem((prev) =>
          prev ? { ...prev, sprint_id: targetId } : null
        );
      }
      const formData = new FormData();
      formData.append('sprint_id', targetId || '');
      updateWorkItem(itemId, formData).catch((err) => {
        console.error('Failed to update work item sprint:', err);
      });
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

  // Group work items by sprint
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

  // Backlog items (sprint_id is null)
  const backlogItems = useMemo(() => {
    return filteredItems.filter((item) => !item.sprint_id);
  }, [filteredItems]);

  // Calculations for sprints (issue counts)
  const sprintStats = useMemo(() => {
    const stats: Record<string, { count: number }> = {};

    sprintList.forEach((sprint) => {
      const sprintItems = workItems.filter(
        (item) => item.sprint_id === sprint.id
      );
      stats[sprint.id] = {
        count: sprintItems.length,
      };
    });

    const backlogWIs = workItems.filter((item) => !item.sprint_id);
    stats['backlog'] = {
      count: backlogWIs.length,
    };

    return stats;
  }, [sprintList, workItems]);

  // Filtered list of sprints based on Active vs Completed tab
  const displayedSprints = useMemo(() => {
    if (activeTab === 'completed') {
      return sprintList.filter((s) => s.status === 'Completed');
    }
    return sprintList.filter(
      (s) => s.status === 'Ongoing' || s.status === 'Not Started'
    );
  }, [sprintList, activeTab]);

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

  // Start Sprint API Caller
  const confirmStartSprint = async (sprintId: string) => {
    if (!isManagerOrAdmin) {
      setActionError('Only admins and managers can perform this action.');
      return;
    }
    setActionError(null);
    setIsActionPending(true);
    try {
      const updatedSprint = await updateSprintStatus(sprintId, 'Ongoing');
      setSprintList((prev) =>
        prev.map((s) => (s.id === sprintId ? updatedSprint : s))
      );
      setSprintToStart(null);
    } catch (err) {
      console.error('Failed to start sprint:', err);
      setActionError(
        err instanceof Error ? err.message : 'Failed to start sprint.'
      );
    } finally {
      setIsActionPending(false);
    }
  };

  // Complete Sprint API Caller
  const confirmCompleteSprint = async (sprintId: string) => {
    if (!isManagerOrAdmin) {
      setActionError('Only admins and managers can perform this action.');
      return;
    }
    setActionError(null);
    setIsActionPending(true);
    try {
      const updatedSprint = await updateSprintStatus(sprintId, 'Completed');
      setSprintList((prev) =>
        prev.map((s) => (s.id === sprintId ? updatedSprint : s))
      );
      setWorkItems((prev) =>
        prev.map((item) =>
          item.sprint_id === sprintId && item.status !== 'Done'
            ? { ...item, sprint_id: null }
            : item
        )
      );
      setSprintToComplete(null);
    } catch (err) {
      console.error('Failed to complete sprint:', err);
      setActionError(
        err instanceof Error ? err.message : 'Failed to complete sprint.'
      );
    } finally {
      setIsActionPending(false);
    }
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

  // Dialog Create Issue Submission
  const handleCreateIssueSuccess = (newWI: DbWorkItem) => {
    setWorkItems((prev) => [newWI, ...prev]);
    setIsCreateIssueOpen(false);
  };

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
    const m = projectMembers.find((member) => member.id === value);
    return m ? { id: m.id, name: m.name, email: m.email } : null;
  };

  // Update multiple inline values of item from details sheet
  const handleUpdateItemFields = (
    itemId: string,
    updates: Partial<DbWorkItem>
  ) => {
    // Check sprint project mismatch if sprint_id or project_id is updated
    for (const [field, value] of Object.entries(updates)) {
      if (checkProjectSprintMismatch(itemId, field, value)) {
        setIsMismatchOpen(true);
        return;
      }
    }

    // Apply all updates to local state
    setWorkItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const updatedAssignee = 'assignee_id' in updates ? getUpdatedAssignee('assignee_id', updates.assignee_id) : null;
        const updatedItem = { ...item, ...updates };
        if ('assignee_id' in updates) {
          updatedItem.assignee = updatedAssignee;
        }
        return updatedItem;
      })
    );

    // Sync selected item state
    setSelectedItem((prev) => {
      if (prev?.id === itemId) {
        const updatedAssignee = 'assignee_id' in updates ? getUpdatedAssignee('assignee_id', updates.assignee_id) : null;
        const updated = { ...prev, ...updates };
        if ('assignee_id' in updates) {
          updated.assignee = updatedAssignee;
        }
        return updated;
      }
      return prev;
    });

    const formData = new FormData();
    for (const [key, value] of Object.entries(updates)) {
      formData.append(key, getFormDataStringValue(value));
    }

    updateWorkItem(itemId, formData).catch((err) => {
      console.error(`Failed to update work item ${itemId}:`, err);
    });
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
    projectFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    priorityFilter !== 'all'
  );

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

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-350 flex-col gap-6 pb-10">
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
          projectMembers={projectMembers}
          isManagerOrAdmin={isManagerOrAdmin}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          preferredLayout={preferredLayout}
          onLayoutChange={setPreferredLayout}
          onCreateSprint={() => setIsCreateSprintOpen(true)}
          onCreateIssue={() => setIsCreateIssueOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          isFiltersActive={isFiltersActive}
          onClearFilters={handleClearFilters}
        />

        {/* Sprints & Backlog Containers */}
        <div className={getBacklogLayoutContainerClass(effectiveLayout)}>
          <div className={getBacklogSprintsPaneClass(effectiveLayout)}>
            {displayedSprints.length === 0 ? (
              <div className="bg-card/35 border-border text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center text-sm">
                <HelpCircle className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
                <p className="font-medium">No {activeTab} sprints found</p>
                <p className="text-muted-foreground/75 mt-1 text-xs">
                  Create a sprint to organize upcoming deliverable workflows.
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
                  onToggle={toggleSprint}
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
                isCollapsed={isBacklogCollapsed}
                isDragOver={dragOverTargetId === 'backlog'}
                onToggle={() => setIsBacklogCollapsed(!isBacklogCollapsed)}
                onCreateIssue={() => setIsCreateIssueOpen(true)}
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
            onClose={() => setIsCreateSprintOpen(false)}
            onCreated={handleCreateSprintSuccess}
          />
        )}

        {/* Dialog: Create Issue */}
        <BacklogCreateIssueDialog
          open={isCreateIssueOpen}
          projects={projects}
          projectMembers={projectMembers}
          onOpenChange={setIsCreateIssueOpen}
          onClose={() => setIsCreateIssueOpen(false)}
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

        {/* Dialog: Project Mismatch Error */}
        <BacklogMismatchDialog
          open={isMismatchOpen}
          onOpenChange={setIsMismatchOpen}
          onAcknowledge={() => setIsMismatchOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}
