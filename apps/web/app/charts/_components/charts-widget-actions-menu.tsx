'use client';

import type { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Copy,
  Pencil,
  Settings,
  SquareDashed,
  Trash2,
} from '@repo/ui/lib/icons';
import { ChartsWidgetExportSubmenu } from '@/app/charts/_components/charts-widget-export-submenu';
import type { ChartsExportFormatId } from '@/app/charts/_components/charts-sample.data';

type ChartsWidgetActionsMenuProps = {
  readonly trigger: ReactNode;
  readonly leadingItem?: ReactNode;
  readonly contentClassName?: string;
  readonly showExport?: boolean;
  readonly showDock?: boolean;
  readonly onRename: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  // eslint-disable-next-line no-unused-vars -- export stub
  readonly onExport?: (format: ChartsExportFormatId) => void;
  readonly open?: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled menu
  readonly onOpenChange?: (open: boolean) => void;
};

export function ChartsWidgetActionsMenu({
  trigger,
  leadingItem,
  contentClassName = 'w-48',
  showExport = false,
  showDock = false,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
  open,
  onOpenChange,
}: Readonly<ChartsWidgetActionsMenuProps>) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        {leadingItem}
        <DropdownMenuItem disabled className="gap-2">
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2" onSelect={onRename}>
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
        {showExport ? <ChartsWidgetExportSubmenu onExport={onExport} /> : null}
        {showDock ? (
          <DropdownMenuItem disabled className="gap-2">
            <SquareDashed className="size-4" />
            Dock this widget
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2"
          onSelect={onDelete}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
