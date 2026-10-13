'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Archive,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Unlock,
} from '@repo/ui/lib/icons';
import { afterDialogClose } from '@/lib/dialog-close';

type ChartsWorkspaceActionsMenuProps = {
  readonly ownership: 'mine' | 'shared';
  readonly status: 'active' | 'archived';
  readonly isScoped?: boolean;
  readonly onRename: () => void;
  readonly onMarkNonScoped?: () => void;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  readonly onRequestDelete: () => void;
};

/** Workspace-level ⋯ menu (rename, archive / restore, delete). Share via Views. */
export function ChartsWorkspaceActionsMenu({
  ownership,
  status,
  isScoped = false,
  onRename,
  onMarkNonScoped,
  onArchive,
  onRestore,
  onRequestDelete,
}: Readonly<ChartsWorkspaceActionsMenuProps>) {
  const isMine = ownership === 'mine';
  const isShared = ownership === 'shared';
  const isActive = status === 'active';
  const isArchived = status === 'archived';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 shrink-0 cursor-pointer"
          aria-label="Workspace actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {isMine ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() => {
              afterDialogClose(onRename);
            }}
          >
            <Pencil className="size-4" />
            Save option
          </DropdownMenuItem>
        ) : null}
        {isMine && isScoped && onMarkNonScoped ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() => {
              afterDialogClose(onMarkNonScoped);
            }}
          >
            <Unlock className="size-4" />
            Mark as non-scoped
          </DropdownMenuItem>
        ) : null}
        {isMine && isActive ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={onArchive}
          >
            <Archive className="size-4" />
            Archive
          </DropdownMenuItem>
        ) : null}
        {isMine && isArchived ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={onRestore}
          >
            <RefreshCw className="size-4" />
            Restore
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
          onSelect={() => {
            afterDialogClose(onRequestDelete);
          }}
        >
          <Trash2 className="size-4" />
          {isShared ? 'Leave' : 'Delete'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
