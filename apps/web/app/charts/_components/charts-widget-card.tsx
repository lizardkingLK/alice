'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Input } from '@repo/ui/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Copy,
  Filter,
  GripVertical,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Settings,
  SquareDashed,
  Trash2,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartWidgetDefinition } from '@/app/charts/_components/charts-widget-catalog';

type ChartsWidgetCardProps = {
  readonly title: string;
  readonly description?: string;
  readonly Icon?: ChartWidgetDefinition['icon'];
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  // eslint-disable-next-line no-unused-vars -- rename callback
  readonly onRename: (title: string) => void;
  readonly className?: string;
};

export function ChartsWidgetCard({
  title,
  description,
  Icon,
  onRemove,
  onDuplicate,
  onRename,
  className,
}: Readonly<ChartsWidgetCardProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(title);

  const openRename = () => {
    setRenameDraft(title);
    setRenameOpen(true);
  };

  const commitRename = () => {
    const next = renameDraft.trim();
    if (next && next !== title) {
      onRename(next);
    }
    setRenameOpen(false);
  };

  const body = (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      {Icon ? <Icon className="text-primary/70 size-10 stroke-1" /> : null}
      <p className="text-foreground max-w-xs text-sm leading-snug font-medium">
        {description ?? 'Configure this widget to get started'}
      </p>
      <p className="text-xs">Select a data source to get started</p>
    </div>
  );

  return (
    <>
      <Card
        className={cn(
          'border-border flex h-full min-h-0 flex-col overflow-hidden shadow-none',
          className
        )}
      >
        <CardHeader className="border-border flex shrink-0 flex-row items-center gap-1 space-y-0 border-b px-2 py-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Drag ${title}`}
                className="widget-drag-handle text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hold to drag</TooltipContent>
          </Tooltip>

          <TruncatedText className="min-w-0 flex-1 px-1 text-sm font-semibold tracking-tight">
            {title}
          </TruncatedText>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Filter ${title}`}
                className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                onClick={() => setFilterOpen(true)}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <Filter className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Filters</TooltipContent>
          </Tooltip>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${title} options`}
                className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => setFullscreenOpen(true)}
              >
                <Maximize2 className="size-4" />
                Full screen
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="gap-2">
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={openRename}
              >
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={onDuplicate}
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="gap-2">
                <SquareDashed className="size-4" />
                Dock this widget
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer gap-2"
                onSelect={onRemove}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-3">
          {body}
        </CardContent>
      </Card>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename widget</DialogTitle>
            <DialogDescription>
              Choose a label for this widget instance on the board.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              }
            }}
            aria-label="Widget name"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={commitRename}
              disabled={!renameDraft.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Widget filters</DialogTitle>
            <DialogDescription>
              Per-widget filters (work item type, status, and more) will land
              here. This is a UI placeholder for now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => setFilterOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="flex h-[min(90vh,800px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <div className="border-border flex shrink-0 items-center gap-2 border-b px-4 py-3 pr-12">
            <DialogTitle className="text-base font-semibold tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full screen view of the {title} widget.
            </DialogDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-6">{body}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
