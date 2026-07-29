'use client';

import type React from 'react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { ChevronDown, ChevronRight, Plus } from '@repo/ui/lib/icons';
import { BacklogDropZone } from '@/app/backlog/_components/backlog-drop-zone';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';

/* eslint-disable no-unused-vars */
type BacklogPanelProps = {
  readonly items: DbWorkItem[];
  readonly projects: DbProject[];
  readonly isCollapsed: boolean;
  readonly isDragOver: boolean;
  readonly onToggle: () => void;
  readonly onCreateIssue: () => void;
  readonly onSelectItem: (item: DbWorkItem) => void;
  readonly onItemDragStart: (event: React.DragEvent, id: string) => void;
  readonly onDragOver: (
    event: React.DragEvent,
    targetId: string | null
  ) => void;
  readonly onDragLeave: () => void;
  readonly onDrop: (event: React.DragEvent, targetId: string | null) => void;
};
/* eslint-enable no-unused-vars */

export function BacklogPanel({
  items,
  projects,
  isCollapsed,
  isDragOver,
  onToggle,
  onCreateIssue,
  onSelectItem,
  onItemDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<BacklogPanelProps>) {
  return (
    <Card className="border-border/70 overflow-hidden shadow-sm">
      <div className="bg-muted/20 hover:bg-muted/40 border-border/50 flex flex-col justify-between gap-3 border-b px-4 py-3 transition-colors sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={onToggle}
          >
            {isCollapsed ? (
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

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={onCreateIssue}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Issue
          </Button>
          <span className="text-muted-foreground bg-muted/65 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {items.length} issue{items.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <BacklogDropZone
          items={items}
          projects={projects}
          targetId={null}
          isDragOver={isDragOver}
          minHeightClass="min-h-37.5"
          emptyMessage="Backlog is empty"
          emptyPaddingClass="py-10"
          emptyIconClass="mb-2 h-6 w-6"
          onSelectItem={onSelectItem}
          onItemDragStart={onItemDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      )}
    </Card>
  );
}
