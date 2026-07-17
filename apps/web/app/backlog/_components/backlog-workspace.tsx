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
} from 'lucide-react';

import { Card } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Label } from '@repo/ui/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});
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
  const [newIssueType, setNewIssueType] = useState<'Epic' | 'Story' | 'Task'>('Task');
  const [newIssuePriority, setNewIssuePriority] = useState<DbWorkItem['priority']>('medium');
  const [newIssueAssigneeId, setNewIssueAssigneeId] = useState('');
  const [newIssueSprintId, setNewIssueSprintId] = useState<string>('backlog');
  const [newIssueProjId, setNewIssueProjId] = useState(projects[0]?.id ?? '');

  // Helper: date format range
  const formatDateRange = (start: string | null | Date, end: string | null | Date) => {
    if (!start || !end) return 'No dates set';
    const s = new Date(start);
    const e = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
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
                projects.find((p) => p.id === draggedItem.project_id)?.name ?? 'Unknown'
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
        setSelectedItem((prev) => prev ? { ...prev, sprint_id: targetId } : null);
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
      const matchesProject = projectFilter === 'all' || item.project_id === projectFilter;
      const matchesAssignee = assigneeFilter === 'all' || item.assignee_id === assigneeFilter;
      
      const mappedPriority = mapPriority(item.priority);
      const matchesPriority = priorityFilter === 'all' || mappedPriority === priorityFilter;

      return matchesSearch && matchesProject && matchesAssignee && matchesPriority;
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
      const sprintItems = workItems.filter((item) => item.sprint_id === sprint.id);
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
    return sprintList.filter((s) => s.status === 'Ongoing' || s.status === 'Not Started');
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
  const handleQuickCreateSubmit = (e: React.FormEvent, sprintId: string | null) => {
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
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), // 1 week out
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
      endDate: newSprintEnd || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      status: 'Not Started',
      createdBy: currentUserId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project: projects.find((p) => p.id === newSprintProjId) ?? null,
    };

    setSprintList((prev) => [newSprint, ...prev]);
    setIsCreateSprintOpen(false);

    // Reset Form
    setNewSprintName('');
    setNewSprintGoal('');
    setNewSprintStart('');
    setNewSprintEnd('');
  };

  // Dialog Create Issue Submission
  const handleCreateIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueTitle.trim()) return;

    const selectedSprintId = newIssueSprintId === 'backlog' ? null : newIssueSprintId;
    const selectedAssignee = projectMembers.find((m) => m.id === newIssueAssigneeId);

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
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      story_points: null,
      status: 'New',
      created_by: currentUserId || null,
      created_at: new Date().toISOString(),
      updated_by: null,
      updated_at: new Date().toISOString(),
      assignee: selectedAssignee
        ? { id: selectedAssignee.id, name: selectedAssignee.name, email: selectedAssignee.email }
        : null,
    };

    setWorkItems((prev) => [newWI, ...prev]);
    setIsCreateIssueOpen(false);

    // Reset Form
    setNewIssueTitle('');
    setNewIssueType('Task');
    setNewIssuePriority('medium');
    setNewIssueAssigneeId('');
    setNewIssueSprintId('backlog');
  };

  // Update inline value of item from details sheet
  const handleUpdateItemField = <K extends keyof DbWorkItem>(itemId: string, field: K, value: DbWorkItem[K]) => {
    let updatedAssignee: { id: string; name: string; email: string } | null = null;
    if (field === 'assignee_id') {
      const m = projectMembers.find((member) => member.id === value);
      updatedAssignee = m ? { id: m.id, name: m.name, email: m.email } : null;
    }

    setWorkItems((prev) =>
      prev.map((item) => updateWorkItemField(item, itemId, field, value, updatedAssignee))
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

  const isFiltersActive = searchQuery || projectFilter !== 'all' || assigneeFilter !== 'all' || priorityFilter !== 'all';

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 w-full max-w-350 mx-auto pb-10">
        
        {/* Error alert */}
        {error && (
          <div className="bg-destructive/15 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="bg-card/40 border border-border/60 rounded-xl p-4 shadow-sm backdrop-blur-md flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">Sprint Planning</h2>

              {/* Active / Completed tabs */}
              <div className="bg-muted/50 border border-border text-muted-foreground inline-flex h-9 items-center justify-center rounded-md p-1 ml-4">
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
                className="cursor-pointer border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold"
                onClick={() => setIsCreateSprintOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create Sprint
              </Button>
              <Button
                size="sm"
                className="cursor-pointer bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search backlog issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background/50 border-border/80 focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Project Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-37.5 bg-background/50 border-border/80 text-xs">
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
              <SelectTrigger className="h-9 w-40 bg-background/50 border-border/80 text-xs">
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
              <SelectTrigger className="h-9 w-35 bg-background/50 border-border/80 text-xs">
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
                className="h-9 px-3 text-muted-foreground hover:text-foreground cursor-pointer text-xs"
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
            <div className="bg-card/35 border border-dashed border-border rounded-xl py-12 px-4 text-center text-muted-foreground text-sm">
              <HelpCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium">No {activeTab} sprints found</p>
              <p className="text-xs text-muted-foreground/75 mt-1">Create a sprint to organize upcoming deliverable workflows.</p>
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
                    "overflow-hidden border-border/70 shadow-sm transition-all duration-200",
                    sprint.status === 'Ongoing' ? "border-l-4 border-l-blue-500 dark:border-l-blue-600" : "border-l-4 border-l-zinc-300 dark:border-l-zinc-700"
                  )}
                >
                  {/* Sprint Header */}
                  <div className="bg-muted/30 hover:bg-muted/50 transition-colors px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        onClick={() => toggleSprint(sprint.id)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{sprint.name}</span>
                          {sprint.status === 'Ongoing' && (
                            <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold px-2 py-0">
                              Ongoing
                            </Badge>
                          )}
                          {sprint.status === 'Completed' && (
                            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0">
                              Completed
                            </Badge>
                          )}
                          {sprint.status === 'Not Started' && (
                            <Badge variant="outline" className="border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 font-semibold px-2 py-0">
                              Planned
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDateRange(sprint.startDate, sprint.endDate)}</span>
                          {sprint.project && (
                            <>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sprint.project.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 flex-wrap md:flex-nowrap">
                      {/* Issue Count badge */}
                      <div className="flex items-center gap-1.5 mr-2">
                        <span className="text-xs text-muted-foreground font-semibold bg-muted/65 px-2.5 py-0.5 rounded-full">
                          {stats.count} issue{stats.count === 1 ? '' : 's'}
                        </span>
                      </div>

                      <Separator orientation="vertical" className="h-6 hidden md:block" />

                      {/* Sprint Actions */}
                      {sprint.status === 'Not Started' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartSprint(sprint.id)}
                          className="cursor-pointer h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Play className="mr-1 h-3 w-3 fill-current" />
                          Start Sprint
                        </Button>
                      )}
                      {sprint.status === 'Ongoing' && (
                        <Button
                          size="sm"
                          onClick={() => handleCompleteSprint(sprint.id)}
                          className="cursor-pointer h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
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
                        "p-3 transition-all duration-200 min-h-22.5 space-y-1.5",
                        isDragOver ? "bg-indigo-500/5 border-2 border-dashed border-indigo-500/30 scale-[0.99] rounded-lg" : "bg-card"
                      )}
                    >
                      {sprintWIs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground text-xs">
                          <HelpCircle className="h-5 w-5 text-muted-foreground/40 mb-1.5" />
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
                          onSubmit={(e) => handleQuickCreateSubmit(e, sprint.id)}
                          className="flex items-center gap-2 mt-2 px-3 py-1.5 border border-dashed border-border/80 rounded-lg bg-background/30 hover:bg-background/60 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Create issue inline..."
                            className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground/60 text-foreground"
                            value={quickTitles[sprint.id] ?? ''}
                            onChange={(e) =>
                              setQuickTitles((prev) => ({ ...prev, [sprint.id]: e.target.value }))
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
            <Card className="border-border/70 shadow-sm overflow-hidden">
              <div className="bg-muted/20 hover:bg-muted/40 transition-colors px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    onClick={() => setIsBacklogCollapsed(!isBacklogCollapsed)}
                  >
                    {isBacklogCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      Backlog
                    </span>
                    <p className="text-xs text-muted-foreground">Unassigned to any active or planned sprint</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-muted-foreground font-semibold bg-muted/65 px-2.5 py-0.5 rounded-full">
                    {backlogItems.length} issue{backlogItems.length === 1 ? '' : 's'}
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
                    "p-3 transition-all duration-200 min-h-37.5 space-y-1.5",
                    dragOverTargetId === 'backlog' ? "bg-indigo-500/5 border-2 border-dashed border-indigo-500/30 scale-[0.99] rounded-lg" : "bg-card"
                  )}
                >
                  {backlogItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground text-xs">
                      <HelpCircle className="h-6 w-6 text-muted-foreground/40 mb-2" />
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
                    className="flex items-center gap-2 mt-3 px-3 py-2 border border-dashed border-border/80 rounded-lg bg-background/30 hover:bg-background/60 transition-colors"
                  >
                    <Plus className="h-4 w-4 text-indigo-500" />
                    <input
                      type="text"
                      placeholder="Quick create issue in backlog... (press Enter)"
                      className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60 text-foreground"
                      value={quickTitles['backlog'] ?? ''}
                      onChange={(e) =>
                        setQuickTitles((prev) => ({ ...prev, backlog: e.target.value }))
                      }
                    />
                  </form>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Slide-out Sheet details panel (Clean, spacious layout with good margins) */}
        <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <SheetContent className="sm:max-w-xl overflow-y-auto border-l border-border bg-card/95 shadow-xl backdrop-blur-md px-8 py-8 transition-all duration-200">
            {selectedItem && (
              <div className="space-y-6">
                <SheetHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold uppercase text-[10px]">
                      {selectedItem.type}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {projects.find((p) => p.id === selectedItem.project_id)?.key || 'ALICE'}-{selectedItem.id.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                  <SheetTitle className="text-xl font-bold tracking-tight text-foreground mt-2">
                    <Input
                      value={selectedItem.title}
                      onChange={(e) => handleUpdateItemField(selectedItem.id, 'title', e.target.value)}
                      className="text-lg font-bold border-none hover:bg-muted/30 focus-visible:bg-background px-1.5 h-auto py-1 shadow-none transition-colors"
                    />
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Edit and manage issue parameters in real-time.
                  </SheetDescription>
                </SheetHeader>

                <Separator />

                {/* Grid details (generous gap-6 and px-2 padding to stay away from borders) */}
                <div className="grid grid-cols-[120px_1fr] gap-x-6 gap-y-5 text-sm px-2">
                  {/* Status Dropdown */}
                  <span className="text-muted-foreground self-center">Status</span>
                  <Select
                    value={selectedItem.status}
                    onValueChange={(val) => handleUpdateItemField(selectedItem.id, 'status', val as DbWorkItem['status'])}
                  >
                    <SelectTrigger className="h-9 w-full bg-background/50 border-border/80">
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
                  <span className="text-muted-foreground self-center">Priority</span>
                  <Select
                    value={mapPriority(selectedItem.priority)}
                    onValueChange={(val) => handleUpdateItemField(selectedItem.id, 'priority', val as DbWorkItem['priority'])}
                  >
                    <SelectTrigger className="h-9 w-full bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">▲ High</SelectItem>
                      <SelectItem value="medium">▪ Medium</SelectItem>
                      <SelectItem value="low">▼ Low</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Assignee Dropdown */}
                  <span className="text-muted-foreground self-center">Assignee</span>
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
                    <SelectTrigger className="h-9 w-full bg-background/50 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {projectMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2 text-xs">
                            <Avatar size="sm" className="size-5">
                              <AvatarFallback className="text-[8px]">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                            <span>{member.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Sprint Selection */}
                  <span className="text-muted-foreground self-center">Sprint</span>
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
                    <SelectTrigger className="h-9 w-full bg-background/50 border-border/80">
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
                  <span className="text-muted-foreground self-center">Due Date</span>
                  <Input
                    type="date"
                    value={selectedItem.due_date ? new Date(selectedItem.due_date).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleUpdateItemField(selectedItem.id, 'due_date', e.target.value)}
                    className="h-9 w-full bg-background/50 border-border/80"
                  />
                </div>

                <Separator className="my-4" />

                {/* Description (Editable block with good spacing) */}
                <div className="space-y-3 px-2">
                  <h4 className="text-sm font-semibold text-foreground">Description</h4>
                  <Textarea
                    placeholder="Describe the objective, scope, and validation criteria..."
                    value={selectedItem.description && typeof selectedItem.description === 'string' ? selectedItem.description : ''}
                    onChange={(e) => handleUpdateItemField(selectedItem.id, 'description', e.target.value)}
                    className="min-h-36 bg-background/50 text-sm leading-relaxed border-border/80 focus:border-indigo-500 transition-colors p-3"
                  />
                </div>

                <Separator className="my-4" />

                {/* Save button */}
                <div className="flex justify-end px-2 pt-2 pb-4">
                  <Button
                    onClick={() => setSelectedItem(null)}
                    className="cursor-pointer bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold h-9 px-6 shadow-md transition-all duration-150"
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
          <DialogContent className="sm:max-w-md bg-card border-border/80 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Create a New Sprint</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set dates and goals to organize upcoming team deliverables.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSprintSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="sprintName" className="text-xs font-semibold">Sprint Name</Label>
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
                  <Label htmlFor="sprintStart" className="text-xs font-semibold">Start Date</Label>
                  <Input
                    id="sprintStart"
                    type="date"
                    value={newSprintStart}
                    onChange={(e) => setNewSprintStart(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sprintEnd" className="text-xs font-semibold">End Date</Label>
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
                <Label htmlFor="sprintProject" className="text-xs font-semibold">Associated Project</Label>
                <Select value={newSprintProjId} onValueChange={setNewSprintProjId}>
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
                <Label htmlFor="sprintGoal" className="text-xs font-semibold">Sprint Goal</Label>
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
                  <Button variant="outline" type="button" className="cursor-pointer h-9 text-xs">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" className="cursor-pointer h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Create Sprint
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Create Issue */}
        <Dialog open={isCreateIssueOpen} onOpenChange={setIsCreateIssueOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border/80 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Create a New Issue</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define the requirements and assign ownership.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateIssueSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="issueTitle" className="text-xs font-semibold">Issue Title</Label>
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
                  <Label htmlFor="issueType" className="text-xs font-semibold">Type</Label>
                  <Select value={newIssueType} onValueChange={(val) => setNewIssueType(val as 'Epic' | 'Story' | 'Task')}>
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
                  <Label htmlFor="issuePriority" className="text-xs font-semibold">Priority</Label>
                  <Select value={newIssuePriority} onValueChange={(val) => setNewIssuePriority(val as DbWorkItem['priority'])}>
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
                <Label htmlFor="issueAssignee" className="text-xs font-semibold">Assignee</Label>
                <Select value={newIssueAssigneeId} onValueChange={setNewIssueAssigneeId}>
                  <SelectTrigger className="bg-background/50 border-border/80">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned_placeholder">Unassigned</SelectItem>
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
                  <Label htmlFor="issueProject" className="text-xs font-semibold">Project</Label>
                  <Select value={newIssueProjId} onValueChange={setNewIssueProjId}>
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
                  <Label htmlFor="issueSprint" className="text-xs font-semibold">Sprint Assignment</Label>
                  <Select value={newIssueSprintId} onValueChange={setNewIssueSprintId}>
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
                  <Button variant="outline" type="button" className="cursor-pointer h-9 text-xs">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" className="cursor-pointer h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Create Issue
                </Button>
              </DialogFooter>
            </form>
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
  const projectKey = projects.find((p) => p.id === item.project_id)?.key || 'ALICE';
  const displayKey = `${projectKey}-${item.id.slice(0, 4).toUpperCase()}`;

  const typeStyles: Record<string, string> = {
    Epic: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    Story: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    Task: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  };

  const normalizedPriority = mapPriority(item.priority);
  const priorityStyles: Record<string, string> = {
    high: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={() => onSelect(item)}
      className={cn(
        "w-full text-left font-normal group relative flex items-center justify-between gap-4 px-3 py-2 border border-border/60 rounded-lg",
        "bg-card/45 hover:bg-muted/30 cursor-grab active:cursor-grabbing hover:border-indigo-500/30",
        "transition-all duration-150 shadow-sm",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Grab Handle */}
        <div className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Issue Type Indicator */}
        <Badge variant="outline" className={cn("text-[9px] uppercase px-1.5 py-0 h-4 border", typeStyles[item.type])}>
          {item.type}
        </Badge>

        {/* Key */}
        <span className="font-mono text-xs font-semibold text-muted-foreground tracking-tight whitespace-nowrap min-w-17.5">
          {displayKey}
        </span>

        {/* Title */}
        <span className="text-sm text-foreground font-medium truncate max-w-md sm:max-w-xl group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {item.title}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Status */}
        <WorkItemStatusBadge status={item.status} />

        {/* Priority Badge */}
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] capitalize px-1.5 py-0 h-4 border font-medium whitespace-nowrap",
            priorityStyles[normalizedPriority]
          )}
        >
          {item.priority}
        </Badge>

        {/* Assignee Avatar */}
        <Avatar size="sm" className="size-6 border border-border/80">
          <AvatarFallback className="text-[9px] font-semibold bg-muted-foreground/15 text-muted-foreground">
            {getInitials(item.assignee?.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </button>
  );
}
