'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@repo/ui/lib/utils';
import {
  Search,
  Plus,
  Calendar,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Layers,
  X,
  Play,
  Check,
  AlertCircle,
  HelpCircle,
} from '@repo/ui/lib/icons';

import { Card } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@repo/ui/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@repo/ui/components/ui/select';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@repo/ui/components/ui/sheet';
import { Separator } from '@repo/ui/components/ui/separator';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';

import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-status-badge';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { Sprint } from '@/app/sprints/_services/sprints.service';
import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { User as DbUser } from '@/app/users/_services/users.service';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';

interface BacklogWorkspaceProps {
  projects: DbProject[];
  projectMembers: DbUser[];
  initialWorkItems: DbWorkItem[];
  sprints: Sprint[];
  userRole: string;
  currentUserId?: string | null;
  error?: string | null;
}

const mapPriority = (p: string): 'low' | 'medium' | 'high' => {
  if (p === 'highest') return 'high';
  if (p === 'lowest') return 'low';
  return p as 'low' | 'medium' | 'high';
};

const updateWorkItemField = <K extends keyof DbWorkItem>(
  item: DbWorkItem,
  itemId: string,
  field: K,
  value: DbWorkItem[K],
  updatedAssignee: { id: string; name: string; email: string } | null
): DbWorkItem => {
  if (item.id === itemId) {
    const updated = { ...item, [field]: value };
    if (field === 'assignee_id') {
      updated.assignee = updatedAssignee;
    }
    return updated;
  }
  return item;
};

export function BacklogWorkspace({
  projects,
  projectMembers,
  initialWorkItems,
  sprints,
  currentUserId,
  error = null,
}: Readonly<BacklogWorkspaceProps>) {
  // Client state
  const [sprintList, setSprintList] = useState<Sprint[]>(sprints);
  const [workItems, setWorkItems] = useState<DbWorkItem[]>(initialWorkItems);

  // Active Tab: active sprints & backlog vs completed sprints
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

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

  // Quick Create Issue state
  const [quickTitles, setQuickTitles] = useState<Record<string, string>>({}); // sprintId -> title

  // Dialogs State
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);

  // Forms State
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');
  const [newSprintProjId, setNewSprintProjId] = useState(projects[0]?.id ?? '');

  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueType, setNewIssueType] = useState<'Epic' | 'Story' | 'Task'>(
    'Task'
  );
  const [newIssuePriority, setNewIssuePriority] =
    useState<DbWorkItem['priority']>('medium');
  const [newIssueAssigneeId, setNewIssueAssigneeId] = useState('');
  const [newIssueSprintId, setNewIssueSprintId] = useState<string>('backlog');
  const [newIssueProjId, setNewIssueProjId] = useState(projects[0]?.id ?? '');

  // Helper: date format range
  const formatDateRange = (
    start: string | null | Date,
    end: string | null | Date
  ) => {
    if (!start || !end) return 'No dates set';
    const s = new Date(start);
    const e = new Date(end);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    return `${s.toLocaleDateString('en-US', options)} - ${e.toLocaleDateString('en-US', options)}`;
  };

  // Helper: Get user initials
  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

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
            alert(
              `Cannot assign task to this sprint. The task belongs to project "${
                projects.find((p) => p.id === draggedItem.project_id)?.name ??
                'Unknown'
              }", but this sprint belongs to "${targetSprint.project?.name ?? 'Unknown'}".`
            );
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

    // Sprints stats
    sprintList.forEach((sprint) => {
      const sprintItems = workItems.filter(
        (item) => item.sprint_id === sprint.id
      );
      stats[sprint.id] = {
        count: sprintItems.length,
      };
    });

    // Backlog stats
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
    setSprintList((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, status: 'Ongoing' } : s))
    );
  };

  // Complete Sprint Handler
  const handleCompleteSprint = (sprintId: string) => {
    setSprintList((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, status: 'Completed' } : s))
    );
    // Move non-Done issues to backlog
    setWorkItems((prev) =>
      prev.map((item) =>
        item.sprint_id === sprintId && item.status !== 'Done'
          ? { ...item, sprint_id: null }
          : item
      )
    );
  };

  // Toggle Collapse
  const toggleSprint = (sprintId: string) => {
    setCollapsedSprints((prev) => ({
      ...prev,
      [sprintId]: !prev[sprintId],
    }));
  };

  // Inline Quick Create Issue Submission
  const handleQuickCreateSubmit = (
    e: React.FormEvent,
    sprintId: string | null
  ) => {
    e.preventDefault();
    const key = sprintId || 'backlog';
    const title = quickTitles[key]?.trim();
    if (!title) return;

    const firstProj = projects[0];
    if (!firstProj) return;

    const newWI: DbWorkItem = {
      id: crypto.randomUUID(),
      title,
      project_id: firstProj.id,
      sprint_id: sprintId,
      parent_id: null,
      type: 'Task',
      priority: 'medium',
      description: null,
      assignee_id: null,
      reporter_id: currentUserId || null,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10), // 1 week out
      story_points: null,
      status: 'New',
      created_by: currentUserId || null,
      created_at: new Date().toISOString(),
      updated_by: null,
      updated_at: new Date().toISOString(),
      assignee: null,
    };

    setWorkItems((prev) => [newWI, ...prev]);
    setQuickTitles((prev) => ({ ...prev, [key]: '' }));
  };

  // Dialog Create Sprint Submission
  const handleCreateSprintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintName.trim()) return;

    const newSprint: Sprint = {
      id: crypto.randomUUID(),
      name: newSprintName,
      goal: newSprintGoal || null,
      startDate: newSprintStart || new Date().toISOString().substring(0, 10),
      endDate:
        newSprintEnd ||
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .substring(0, 10),
      status: 'Not Started',
      createdBy: currentUserId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project: projects.find((p) => p.id === newSprintProjId) ?? null,
    };

  const handleCreateSprintSuccess = (newSprint: Sprint) => {
    setSprintList((prev) => [newSprint, ...prev]);
    setIsCreateSprintOpen(false);
  };

  // Dialog Create Issue Submission
  const handleCreateIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueTitle.trim()) return;

    const selectedSprintId =
      newIssueSprintId === 'backlog' ? null : newIssueSprintId;
    const selectedAssignee = projectMembers.find(
      (m) => m.id === newIssueAssigneeId
    );

    const newWI: DbWorkItem = {
      id: crypto.randomUUID(),
      title: newIssueTitle,
      project_id: newIssueProjId,
      sprint_id: selectedSprintId,
      parent_id: null,
      type: newIssueType,
      priority: newIssuePriority,
      description: null,
      assignee_id: newIssueAssigneeId || null,
      reporter_id: currentUserId || null,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10),
      story_points: null,
      status: 'New',
      created_by: currentUserId || null,
      created_at: new Date().toISOString(),
      updated_by: null,
      updated_at: new Date().toISOString(),
      assignee: selectedAssignee
        ? {
            id: selectedAssignee.id,
            name: selectedAssignee.name,
            email: selectedAssignee.email,
          }
        : null,
    };

  const handleCreateIssueSuccess = (newWI: DbWorkItem) => {
    setWorkItems((prev) => [newWI, ...prev]);
    setIsCreateIssueOpen(false);
  };

  // Update inline value of item from details sheet
  const handleUpdateItemField = <K extends keyof DbWorkItem>(
    itemId: string,
    field: K,
    value: DbWorkItem[K]
  ) => {
    let updatedAssignee: { id: string; name: string; email: string } | null =
      null;
    if (field === 'assignee_id') {
      const m = projectMembers.find((member) => member.id === value);
      updatedAssignee = m ? { id: m.id, name: m.name, email: m.email } : null;
    }

    setWorkItems((prev) =>
      prev.map((item) =>
        updateWorkItemField(item, itemId, field, value, updatedAssignee)
      )
    );

    // Sync selected item state
    setSelectedItem((prev) => {
      if (prev?.id === itemId) {
        const updated = { ...prev, [field]: value };
        if (field === 'assignee_id') {
          updated.assignee = updatedAssignee;
        }
        return updated;
      }
      return prev;
    });
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setProjectFilter('all');
    setAssigneeFilter('all');
    setPriorityFilter('all');
  };

  const isFiltersActive =
    searchQuery ||
    projectFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    priorityFilter !== 'all';

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
        <div className="bg-card/40 border-border/60 flex flex-col gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-indigo-500" />
              <h2 className="text-foreground text-xl font-bold tracking-tight">
                Sprint Planning
              </h2>

              {/* Active / Completed tabs */}
              <div className="bg-muted/50 border-border text-muted-foreground ml-4 inline-flex h-9 items-center justify-center rounded-md border p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('active')}
                  className={cn(
                    'h-7 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all',
                    activeTab === 'active'
                      ? 'bg-background text-foreground hover:bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  Active
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('completed')}
                  className={cn(
                    'h-7 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all',
                    activeTab === 'completed'
                      ? 'bg-background text-foreground hover:bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  Completed
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-indigo-500/20 bg-indigo-500/5 font-semibold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
                onClick={() => setIsCreateSprintOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create Sprint
              </Button>
              <Button
                size="sm"
                className="cursor-pointer bg-linear-to-r from-indigo-500 to-violet-600 font-semibold text-white hover:from-indigo-600 hover:to-violet-700"
                onClick={() => setIsCreateIssueOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create Issue
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search backlog issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background/50 border-border/80 h-9 pl-9 transition-colors focus:border-indigo-500"
              />
            </div>

            {/* Project Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="bg-background/50 border-border/80 h-9 w-37.5 text-xs">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assignee Filter */}
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="bg-background/50 border-border/80 h-9 w-40 text-xs">
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {projectMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="bg-background/50 border-border/80 h-9 w-35 text-xs">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {isFiltersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
              >
                Clear Filters
                <X className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Sprints & Backlog Containers */}
        <div className="space-y-4">
          {/* Display Sprints */}
          {displayedSprints.length === 0 ? (
            <div className="bg-card/35 border-border text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center text-sm">
              <HelpCircle className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
              <p className="font-medium">No {activeTab} sprints found</p>
              <p className="text-muted-foreground/75 mt-1 text-xs">
                Create a sprint to organize upcoming deliverable workflows.
              </p>
            </div>
          ) : (
            displayedSprints.map((sprint) => {
              const sprintWIs = itemsBySprint[sprint.id] || [];
              const isCollapsed = !!collapsedSprints[sprint.id];
              const stats = sprintStats[sprint.id] || { count: 0 };
              const isDragOver = dragOverTargetId === sprint.id;

              return (
                <Card
                  key={sprint.id}
                  className={cn(
                    'border-border/70 overflow-hidden shadow-sm transition-all duration-200',
                    sprint.status === 'Ongoing'
                      ? 'border-l-4 border-l-blue-500 dark:border-l-blue-600'
                      : 'border-l-4 border-l-zinc-300 dark:border-l-zinc-700'
                  )}
                >
                  {/* Sprint Header */}
                  <div className="bg-muted/30 hover:bg-muted/50 border-border/50 flex flex-col justify-between gap-3 border-b px-4 py-3 transition-colors md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        onClick={() => toggleSprint(sprint.id)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="text-muted-foreground h-4 w-4" />
                        ) : (
                          <ChevronDown className="text-muted-foreground h-4 w-4" />
                        )}
                      </Button>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-semibold">
                            {sprint.name}
                          </span>
                          {sprint.status === 'Ongoing' && (
                            <Badge
                              variant="outline"
                              className="border-blue-500/20 bg-blue-500/10 px-2 py-0 font-semibold text-blue-600 dark:text-blue-400"
                            >
                              Ongoing
                            </Badge>
                          )}
                          {sprint.status === 'Completed' && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/20 bg-emerald-500/10 px-2 py-0 font-semibold text-emerald-600 dark:text-emerald-400"
                            >
                              Completed
                            </Badge>
                          )}
                          {sprint.status === 'Not Started' && (
                            <Badge
                              variant="outline"
                              className="border-zinc-500/20 bg-zinc-500/10 px-2 py-0 font-semibold text-zinc-600 dark:text-zinc-400"
                            >
                              Planned
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {formatDateRange(sprint.startDate, sprint.endDate)}
                          </span>
                          {sprint.project && (
                            <>
                              <span className="text-muted-foreground/60">
                                •
                              </span>
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {sprint.project.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 md:flex-nowrap">
                      {/* Issue Count badge */}
                      <div className="mr-2 flex items-center gap-1.5">
                        <span className="text-muted-foreground bg-muted/65 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                          {stats.count} issue{stats.count === 1 ? '' : 's'}
                        </span>
                      </div>

                      <Separator
                        orientation="vertical"
                        className="hidden h-6 md:block"
                      />

                      {/* Sprint Actions */}
                      {sprint.status === 'Not Started' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartSprint(sprint.id)}
                          className="h-8 cursor-pointer bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Play className="mr-1 h-3 w-3 fill-current" />
                          Start Sprint
                        </Button>
                      )}
                      {sprint.status === 'Ongoing' && (
                        <Button
                          size="sm"
                          onClick={() => handleCompleteSprint(sprint.id)}
                          className="h-8 cursor-pointer bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Complete Sprint
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Sprint Content Drop Zone */}
                  {!isCollapsed && (
                    <div
                      onDragOver={(e) => handleDragOver(e, sprint.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, sprint.id)}
                      className={cn(
                        'min-h-22.5 space-y-1.5 p-3 transition-all duration-200',
                        isDragOver
                          ? 'scale-[0.99] rounded-lg border-2 border-dashed border-indigo-500/30 bg-indigo-500/5'
                          : 'bg-card'
                      )}
                    >
                      {sprintWIs.length === 0 ? (
                        <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center text-xs">
                          <HelpCircle className="text-muted-foreground/40 mb-1.5 h-5 w-5" />
                          <p>Plan this sprint by dragging backlog items here</p>
                        </div>
                      ) : (
                        sprintWIs.map((item) => (
                          <IssueRow
                            key={item.id}
                            item={item}
                            projects={projects}
                            onSelect={setSelectedItem}
                            onDragStart={handleDragStart}
                            getInitials={getInitials}
                          />
                        ))
                      )}

                      {/* Sprint Inline Quick Create */}
                      {sprint.status !== 'Completed' && (
                        <form
                          onSubmit={(e) =>
                            handleQuickCreateSubmit(e, sprint.id)
                          }
                          className="border-border/80 bg-background/30 hover:bg-background/60 mt-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 transition-colors"
                        >
                          <Plus className="text-muted-foreground h-3.5 w-3.5" />
                          <input
                            type="text"
                            placeholder="Create issue inline..."
                            className="placeholder:text-muted-foreground/60 text-foreground w-full border-none bg-transparent text-xs outline-none"
                            value={quickTitles[sprint.id] ?? ''}
                            onChange={(e) =>
                              setQuickTitles((prev) => ({
                                ...prev,
                                [sprint.id]: e.target.value,
                              }))
                            }
                          />
                        </form>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}

          {/* Backlog Section (Only visible on Active Tab) */}
          {activeTab === 'active' && (
            <Card className="border-border/70 overflow-hidden shadow-sm">
              <div className="bg-muted/20 hover:bg-muted/40 border-border/50 flex flex-col justify-between gap-3 border-b px-4 py-3 transition-colors sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    onClick={() => setIsBacklogCollapsed(!isBacklogCollapsed)}
                  >
                    {isBacklogCollapsed ? (
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ChevronDown className="text-muted-foreground h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground flex items-center gap-2 font-semibold">
                      Backlog
                    </span>
                    <p className="text-muted-foreground text-xs">
                      Unassigned to any active or planned sprint
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <span className="text-muted-foreground bg-muted/65 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {backlogItems.length} issue
                    {backlogItems.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Backlog Drop Target Container */}
              {!isBacklogCollapsed && (
                <div
                  onDragOver={(e) => handleDragOver(e, null)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, null)}
                  className={cn(
                    'min-h-37.5 space-y-1.5 p-3 transition-all duration-200',
                    dragOverTargetId === 'backlog'
                      ? 'scale-[0.99] rounded-lg border-2 border-dashed border-indigo-500/30 bg-indigo-500/5'
                      : 'bg-card'
                  )}
                >
                  {backlogItems.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center justify-center py-10 text-center text-xs">
                      <HelpCircle className="text-muted-foreground/40 mb-2 h-6 w-6" />
                      <p>Backlog is empty</p>
                    </div>
                  ) : (
                    backlogItems.map((item) => (
                      <IssueRow
                        key={item.id}
                        item={item}
                        projects={projects}
                        onSelect={setSelectedItem}
                        onDragStart={handleDragStart}
                        getInitials={getInitials}
                      />
                    ))
                  )}

                  {/* Backlog Quick Create Form */}
                  <form
                    onSubmit={(e) => handleQuickCreateSubmit(e, null)}
                    className="border-border/80 bg-background/30 hover:bg-background/60 mt-3 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 transition-colors"
                  >
                    <Plus className="h-4 w-4 text-indigo-500" />
                    <input
                      type="text"
                      placeholder="Quick create issue in backlog... (press Enter)"
                      className="placeholder:text-muted-foreground/60 text-foreground w-full border-none bg-transparent text-sm outline-none"
                      value={quickTitles['backlog'] ?? ''}
                      onChange={(e) =>
                        setQuickTitles((prev) => ({
                          ...prev,
                          backlog: e.target.value,
                        }))
                      }
                    />
                  </form>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Slide-out Sheet details panel (Clean, spacious layout with good margins) */}
        <Sheet
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        >
          <SheetContent className="border-border bg-card/95 overflow-y-auto border-l px-8 py-8 shadow-xl backdrop-blur-md transition-all duration-200 sm:max-w-xl">
            {selectedItem && (
              <div className="space-y-6">
                <SheetHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="border-indigo-500/20 bg-indigo-500/10 text-[10px] font-semibold text-indigo-600 uppercase dark:text-indigo-400"
                    >
                      {selectedItem.type}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-xs">
                      {projects.find((p) => p.id === selectedItem.project_id)
                        ?.key || 'ALICE'}
                      -{selectedItem.id.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                  <SheetTitle className="text-foreground mt-2 text-xl font-bold tracking-tight">
                    <Input
                      value={selectedItem.title}
                      onChange={(e) =>
                        handleUpdateItemField(
                          selectedItem.id,
                          'title',
                          e.target.value
                        )
                      }
                      className="hover:bg-muted/30 focus-visible:bg-background h-auto border-none px-1.5 py-1 text-lg font-bold shadow-none transition-colors"
                    />
                  </SheetTitle>
                  <SheetDescription className="text-muted-foreground text-xs">
                    Edit and manage issue parameters in real-time.
                  </SheetDescription>
                </SheetHeader>

                <Separator />

                {/* Grid details (generous gap-6 and px-2 padding to stay away from borders) */}
                <div className="grid grid-cols-[120px_1fr] gap-x-6 gap-y-5 px-2 text-sm">
                  {/* Status Dropdown */}
                  <span className="text-muted-foreground self-center">
                    Status
                  </span>
                  <Select
                    value={selectedItem.status}
                    onValueChange={(val) =>
                      handleUpdateItemField(
                        selectedItem.id,
                        'status',
                        val as DbWorkItem['status']
                      )
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/80 h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="ToDo">To Do</SelectItem>
                      <SelectItem value="InProgress">In Progress</SelectItem>
                      <SelectItem value="Testing">Testing</SelectItem>
                      <SelectItem value="Done">Done</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Priority Dropdown */}
                  <span className="text-muted-foreground self-center">
                    Priority
                  </span>
                  <Select
                    value={mapPriority(selectedItem.priority)}
                    onValueChange={(val) =>
                      handleUpdateItemField(
                        selectedItem.id,
                        'priority',
                        val as DbWorkItem['priority']
                      )
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/80 h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">▲ High</SelectItem>
                      <SelectItem value="medium">▪ Medium</SelectItem>
                      <SelectItem value="low">▼ Low</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Assignee Dropdown */}
                  <span className="text-muted-foreground self-center">
                    Assignee
                  </span>
                  <Select
                    value={selectedItem.assignee_id || 'unassigned'}
                    onValueChange={(val) =>
                      handleUpdateItemField(
                        selectedItem.id,
                        'assignee_id',
                        val === 'unassigned' ? null : val
                      )
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/80 h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {projectMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2 text-xs">
                            <Avatar size="sm" className="size-5">
                              <AvatarFallback className="text-[8px]">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Sprint Selection */}
                  <span className="text-muted-foreground self-center">
                    Sprint
                  </span>
                  <Select
                    value={selectedItem.sprint_id || 'backlog'}
                    onValueChange={(val) =>
                      handleUpdateItemField(
                        selectedItem.id,
                        'sprint_id',
                        val === 'backlog' ? null : val
                      )
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/80 h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      {sprintList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Due Date */}
                  <span className="text-muted-foreground self-center">
                    Due Date
                  </span>
                  <Input
                    type="date"
                    value={
                      selectedItem.due_date
                        ? new Date(selectedItem.due_date)
                            .toISOString()
                            .split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      handleUpdateItemField(
                        selectedItem.id,
                        'due_date',
                        e.target.value
                      )
                    }
                    className="bg-background/50 border-border/80 h-9 w-full"
                  />
                </div>

                <Separator className="my-4" />

                {/* Description (Editable block with good spacing) */}
                <div className="space-y-3 px-2">
                  <h4 className="text-foreground text-sm font-semibold">
                    Description
                  </h4>
                  <Textarea
                    placeholder="Describe the objective, scope, and validation criteria..."
                    value={
                      selectedItem.description &&
                      typeof selectedItem.description === 'string'
                        ? selectedItem.description
                        : ''
                    }
                    onChange={(e) =>
                      handleUpdateItemField(
                        selectedItem.id,
                        'description',
                        e.target.value
                      )
                    }
                    className="bg-background/50 border-border/80 min-h-36 p-3 text-sm leading-relaxed transition-colors focus:border-indigo-500"
                  />
                </div>

                <Separator className="my-4" />

                {/* Save button */}
                <div className="flex justify-end px-2 pt-2 pb-4">
                  <Button
                    onClick={() => setSelectedItem(null)}
                    className="h-9 cursor-pointer bg-linear-to-r from-indigo-500 to-violet-600 px-6 font-semibold text-white shadow-md transition-all duration-150 hover:from-indigo-600 hover:to-violet-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Dialog: Create Sprint */}
        <Dialog open={isCreateSprintOpen} onOpenChange={setIsCreateSprintOpen}>
          <DialogContent className="bg-card border-border/80 backdrop-blur-md sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Create a New Sprint
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Set dates and goals to organize upcoming team deliverables.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleCreateSprintSubmit}
              className="space-y-4 py-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="sprintName" className="text-xs font-semibold">
                  Sprint Name
                </Label>
                <Input
                  id="sprintName"
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  placeholder="e.g. Sprint 4 - Auth Setup"
                  required
                  className="bg-background/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="sprintStart"
                    className="text-xs font-semibold"
                  >
                    Start Date
                  </Label>
                  <Input
                    id="sprintStart"
                    type="date"
                    value={newSprintStart}
                    onChange={(e) => setNewSprintStart(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sprintEnd" className="text-xs font-semibold">
                    End Date
                  </Label>
                  <Input
                    id="sprintEnd"
                    type="date"
                    value={newSprintEnd}
                    onChange={(e) => setNewSprintEnd(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="sprintProject"
                  className="text-xs font-semibold"
                >
                  Associated Project
                </Label>
                <Select
                  value={newSprintProjId}
                  onValueChange={setNewSprintProjId}
                >
                  <SelectTrigger className="bg-background/50 border-border/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sprintGoal" className="text-xs font-semibold">
                  Sprint Goal
                </Label>
                <Textarea
                  id="sprintGoal"
                  value={newSprintGoal}
                  onChange={(e) => setNewSprintGoal(e.target.value)}
                  placeholder="e.g. Complete Supabase integration and set up secure middleware"
                  className="bg-background/50 min-h-20"
                />
              </div>

              <DialogFooter className="pt-2">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="h-9 cursor-pointer text-xs"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  className="h-9 cursor-pointer bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Create Sprint
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Create Issue */}
        <Dialog open={isCreateIssueOpen} onOpenChange={setIsCreateIssueOpen}>
          <DialogContent className="bg-card border-border/80 backdrop-blur-md sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Create a New Issue
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Define the requirements and assign ownership.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateIssueSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="issueTitle" className="text-xs font-semibold">
                  Issue Title
                </Label>
                <Input
                  id="issueTitle"
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  placeholder="e.g. Build analytics API handler"
                  required
                  className="bg-background/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="issueType" className="text-xs font-semibold">
                    Type
                  </Label>
                  <Select
                    value={newIssueType}
                    onValueChange={(val) =>
                      setNewIssueType(val as 'Epic' | 'Story' | 'Task')
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Task">Task</SelectItem>
                      <SelectItem value="Story">Story</SelectItem>
                      <SelectItem value="Epic">Epic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="issuePriority"
                    className="text-xs font-semibold"
                  >
                    Priority
                  </Label>
                  <Select
                    value={newIssuePriority}
                    onValueChange={(val) =>
                      setNewIssuePriority(val as DbWorkItem['priority'])
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="issueAssignee"
                  className="text-xs font-semibold"
                >
                  Assignee
                </Label>
                <Select
                  value={newIssueAssigneeId}
                  onValueChange={setNewIssueAssigneeId}
                >
                  <SelectTrigger className="bg-background/50 border-border/80">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned_placeholder">
                      Unassigned
                    </SelectItem>
                    {projectMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="issueProject"
                    className="text-xs font-semibold"
                  >
                    Project
                  </Label>
                  <Select
                    value={newIssueProjId}
                    onValueChange={setNewIssueProjId}
                  >
                    <SelectTrigger className="bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((proj) => (
                        <SelectItem key={proj.id} value={proj.id}>
                          {proj.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="issueSprint"
                    className="text-xs font-semibold"
                  >
                    Sprint Assignment
                  </Label>
                  <Select
                    value={newIssueSprintId}
                    onValueChange={setNewIssueSprintId}
                  >
                    <SelectTrigger className="bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      {sprintList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="h-9 cursor-pointer text-xs"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  className="h-9 cursor-pointer bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Create Issue
                </Button>
              </DialogFooter>
            </form>
        {isCreateSprintOpen && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
            <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
              <SprintForm
                onSprintUpdated={handleCreateSprintSuccess}
                onClose={() => setIsCreateSprintOpen(false)}
                onSuccess={() => setIsCreateSprintOpen(false)}
                currentUserId={currentUserId}
              />
            </div>
          </div>
        )}

        {/* Dialog: Create Issue */}
        <Dialog open={isCreateIssueOpen} onOpenChange={setIsCreateIssueOpen}>
          <DialogContent className="sm:max-w-xl bg-card border-border/80 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Create Work Item</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Add a new work item and assign it to a team member.
              </DialogDescription>
            </DialogHeader>
            <WorkItemForm
              projects={projects}
              projectMembers={projectMembers}
              onClose={() => setIsCreateIssueOpen(false)}
              onSuccess={handleCreateIssueSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/* eslint-disable no-unused-vars */
interface IssueRowProps {
  item: DbWorkItem;
  projects: DbProject[];
  onSelect: (item: DbWorkItem) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  getInitials: (name?: string | null) => string;
}
/* eslint-enable no-unused-vars */

function IssueRow({
  item,
  projects,
  onSelect,
  onDragStart,
  getInitials,
}: Readonly<IssueRowProps>) {
  const projectKey =
    projects.find((p) => p.id === item.project_id)?.key || 'ALICE';
  const displayKey = `${projectKey}-${item.id.slice(0, 4).toUpperCase()}`;

  const typeStyles: Record<string, string> = {
    Epic: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    Story: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    Task: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  };

  const normalizedPriority = mapPriority(item.priority);
  const priorityStyles: Record<string, string> = {
    high: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    medium:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={() => onSelect(item)}
      className={cn(
        'group border-border/60 relative flex w-full items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left font-normal',
        'bg-card/45 hover:bg-muted/30 cursor-grab hover:border-indigo-500/30 active:cursor-grabbing',
        'shadow-sm transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Grab Handle */}
        <div className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Issue Type Indicator */}
        <Badge
          variant="outline"
          className={cn(
            'h-4 border px-1.5 py-0 text-[9px] uppercase',
            typeStyles[item.type]
          )}
        >
          {item.type}
        </Badge>

        {/* Key */}
        <span className="text-muted-foreground min-w-17.5 font-mono text-xs font-semibold tracking-tight whitespace-nowrap">
          {displayKey}
        </span>

        {/* Title */}
        <span className="text-foreground max-w-md truncate text-sm font-medium transition-colors group-hover:text-indigo-600 sm:max-w-xl dark:group-hover:text-indigo-400">
          {item.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Status */}
        <WorkItemStatusBadge status={item.status} />

        {/* Priority Badge */}
        <Badge
          variant="outline"
          className={cn(
            'h-4 border px-1.5 py-0 text-[9px] font-medium whitespace-nowrap capitalize',
            priorityStyles[normalizedPriority]
          )}
        >
          {item.priority}
        </Badge>

        {/* Assignee Avatar */}
        <Avatar size="sm" className="border-border/80 size-6 border">
          <AvatarFallback className="bg-muted-foreground/15 text-muted-foreground text-[9px] font-semibold">
            {getInitials(item.assignee?.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </button>
  );
}
