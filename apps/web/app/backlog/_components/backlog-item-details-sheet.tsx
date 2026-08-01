'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  mapPriority,
  projectDisplayKey,
} from '@/app/backlog/_helpers/backlog-item-utils';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { MemberSelectItems } from '@/app/work-items/_components/member-select-items';
import { WorkItemTypeBadge } from '@/app/work-items/_components/workItem-badge-type';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import { WORK_ITEM_STATUSES } from '@/app/work-items/_helpers/work-item-status';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { User as DbUser } from '@/app/users/_services/users.service';
import { ExternalLink } from '@repo/ui/lib/icons';

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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <WorkItemTypeBadge
                  type={item.type}
                  compact
                  className="text-[10px] font-semibold"
                />
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                >
                  <Link
                    href={workItemDetailHref(item.id, {
                      fromProjectId: item.project_id,
                    })}
                  >
                    {projectDisplayKey(
                      projects.find((p) => p.id === item.project_id)?.key,
                      item.id
                    )}
                    <ExternalLink data-icon="inline-end" className="size-3.5" />
                  </Link>
                </Button>
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
                    {WORK_ITEM_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatLabelWithSpace(status)}
                      </SelectItem>
                    ))}
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
                    <MemberSelectItems
                      members={projectMembers}
                      itemClassName="text-xs"
                    />
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

            <div className="flex justify-end gap-2 px-2 pt-2 pb-4">
              <Button asChild variant="outline" className="h-9 cursor-pointer">
                <Link
                  href={workItemDetailHref(item.id, {
                    fromProjectId: item.project_id,
                  })}
                >
                  Open work item
                  <ExternalLink data-icon="inline-end" className="size-3.5" />
                </Link>
              </Button>
              <Button onClick={handleSave} className="h-9 cursor-pointer px-6">
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
