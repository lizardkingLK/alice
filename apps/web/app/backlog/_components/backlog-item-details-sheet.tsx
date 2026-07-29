'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import {
  getInitials,
  mapPriority,
} from '@/app/backlog/_helpers/backlog-item-utils';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { User as DbUser } from '@/app/users/_services/users.service';

/* eslint-disable no-unused-vars */
type BacklogItemDetailsSheetProps = {
  readonly item: DbWorkItem | null;
  readonly projects: DbProject[];
  readonly projectMembers: DbUser[];
  readonly sprints: Sprint[];
  readonly blockOutsideClose: boolean;
  readonly onClose: () => void;
  readonly onUpdateFields: (
    itemId: string,
    updates: Partial<DbWorkItem>
  ) => void;
};
/* eslint-enable no-unused-vars */

export function BacklogItemDetailsSheet({
  item,
  projects,
  projectMembers,
  sprints,
  blockOutsideClose,
  onClose,
  onUpdateFields,
}: Readonly<BacklogItemDetailsSheetProps>) {
  const [draft, setDraft] = useState<Partial<DbWorkItem>>({});

  useEffect(() => {
    setDraft({});
  }, [item?.id]);

  const handleSave = () => {
    if (item && Object.keys(draft).length > 0) {
      onUpdateFields(item.id, draft);
    }
    onClose();
  };

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        onPointerDownOutside={(e) => {
          if (blockOutsideClose) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (blockOutsideClose) {
            e.preventDefault();
          }
        }}
        className="border-border bg-card/95 overflow-y-auto border-l px-8 py-8 shadow-xl backdrop-blur-md transition-all duration-200 sm:max-w-2xl"
      >
        {item && (
          <div className="space-y-6">
            <SheetHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="border-indigo-500/20 bg-indigo-500/10 text-[10px] font-semibold text-indigo-600 uppercase dark:text-indigo-400"
                >
                  {item.type}
                </Badge>
                <span className="text-muted-foreground font-mono text-xs">
                  {projects.find((p) => p.id === item.project_id)?.key ||
                    'ALICE'}
                  -{item.id.slice(0, 4).toUpperCase()}
                </span>
              </div>
              <SheetTitle className="text-foreground mt-2 text-xl font-bold tracking-tight">
                <Input
                  value={draft.title ?? item.title ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="hover:bg-muted/30 focus-visible:bg-background h-auto border-none px-1.5 py-1 text-lg font-bold shadow-none transition-colors"
                />
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">
                Edit and manage issue parameters in real-time.
              </SheetDescription>
            </SheetHeader>

            <Separator />

            <div className="grid grid-cols-[120px_1fr] gap-x-6 gap-y-5 px-2 text-sm">
              <span className="text-muted-foreground self-center">Project</span>
              <div className="min-w-0">
                <Select
                  value={draft.project_id ?? item.project_id ?? ''}
                  onValueChange={(val) =>
                    setDraft((prev) => ({ ...prev, project_id: val }))
                  }
                >
                  <SelectTrigger className="bg-background/50 border-border/80 h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground self-center">Status</span>
              <div className="min-w-0">
                <Select
                  value={draft.status ?? item.status ?? ''}
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      status: val as DbWorkItem['status'],
                    }))
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
              </div>

              <span className="text-muted-foreground self-center">
                Priority
              </span>
              <div className="min-w-0">
                <Select
                  value={
                    draft.priority !== undefined
                      ? mapPriority(draft.priority)
                      : mapPriority(item.priority)
                  }
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      priority: val as DbWorkItem['priority'],
                    }))
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
              </div>

              <span className="text-muted-foreground self-center">
                Assignee
              </span>
              <div className="min-w-0">
                <Select
                  value={
                    draft.assignee_id !== undefined
                      ? draft.assignee_id || 'unassigned'
                      : item.assignee_id || 'unassigned'
                  }
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      assignee_id: val === 'unassigned' ? null : val,
                    }))
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
              </div>

              <span className="text-muted-foreground self-center">Sprint</span>
              <div className="min-w-0">
                <Select
                  value={
                    draft.sprint_id !== undefined
                      ? draft.sprint_id || 'backlog'
                      : item.sprint_id || 'backlog'
                  }
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      sprint_id: val === 'backlog' ? null : val,
                    }))
                  }
                >
                  <SelectTrigger className="bg-background/50 border-border/80 h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    {sprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground self-center">
                Due Date
              </span>
              <div className="min-w-0">
                <Input
                  type="date"
                  value={(() => {
                    const d = draft.due_date ?? item.due_date;
                    return d ? new Date(d).toISOString().split('T')[0] : '';
                  })()}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, due_date: e.target.value }))
                  }
                  className="bg-background/50 border-border/80 h-9 w-full"
                />
              </div>

              <span className="text-muted-foreground self-center">
                Story Points
              </span>
              <div className="min-w-0">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter Story Points"
                  value={
                    draft.story_points !== undefined
                      ? (draft.story_points ?? '')
                      : (item.story_points ?? '')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = val === '' ? null : Number.parseInt(val, 10);
                    if (num === null || (!Number.isNaN(num) && num >= 0)) {
                      setDraft((prev) => ({ ...prev, story_points: num }));
                    }
                  }}
                  className="bg-background/50 border-border/80 h-9 w-full"
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex justify-end px-2 pt-2 pb-4">
              <Button
                onClick={handleSave}
                className="h-9 cursor-pointer bg-linear-to-r from-indigo-500 to-violet-600 px-6 font-semibold text-white shadow-md transition-all duration-150 hover:from-indigo-600 hover:to-violet-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
