'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Share2 } from '@repo/ui/lib/icons';

type ChartsWorkspaceActionsMenuProps = {
  readonly onShare: () => void;
  readonly onRename: () => void;
};

/** Workspace-level ⋯ menu (share + rename/save). */
export function ChartsWorkspaceActionsMenu({
  onShare,
  onRename,
}: Readonly<ChartsWorkspaceActionsMenuProps>) {
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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem className="cursor-pointer gap-2" onSelect={onShare}>
          <Share2 className="size-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2" onSelect={onRename}>
          <Pencil className="size-4" />
          Rename / Save
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
