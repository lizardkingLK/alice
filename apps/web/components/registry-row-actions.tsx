'use client';

import {
  MoreHorizontal,
  Archive,
  Pencil,
  RefreshCw,
  Trash2,
} from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';

export interface RegistryRowActionsProps {
  readonly isPending: boolean;
  readonly isManagerOrAdmin: boolean;
  readonly isAdmin: boolean;
  /** Active (non-archived) rows show Edit + Archive; archived show Restore + Purge. */
  readonly isActiveView: boolean;
  /**
   * When set, overrides the manager gate for Edit (work items: any member).
   * Defaults to `isManagerOrAdmin`.
   */
  readonly canEdit?: boolean;
  /**
   * When set, overrides the manager gate for Archive/Restore.
   * Defaults to `isManagerOrAdmin`.
   */
  readonly canArchive?: boolean;
  readonly onEdit: () => void;
  readonly onRestore: () => void;
  readonly onArchive: () => void;
  readonly onPurge: () => void;
}

/** Edit / Restore / Archive / Purge action pair for registry DataTable rows. */
export function RegistryRowActions({
  isPending,
  isManagerOrAdmin,
  isAdmin,
  isActiveView,
  canEdit,
  canArchive,
  onEdit,
  onRestore,
  onArchive,
  onPurge,
}: Readonly<RegistryRowActionsProps>) {
  const allowEdit = canEdit ?? isManagerOrAdmin;
  const allowArchive = canArchive ?? isManagerOrAdmin;
  const showEdit = isActiveView && allowEdit;
  const showArchive = isActiveView && allowArchive;
  const showRestore = !isActiveView && allowArchive;
  const showPurge = !isActiveView && isAdmin;

  const hasActions = showEdit || showArchive || showRestore || showPurge;

  if (!hasActions) {
    return <div className="w-8 shrink-0" />;
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            className="cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showEdit && (
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
          )}
          {showRestore && (
            <DropdownMenuItem onClick={onRestore} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Restore
            </DropdownMenuItem>
          )}
          {showArchive && (
            <DropdownMenuItem
              onClick={onArchive}
              className="gap-2 text-amber-600 focus:text-amber-600 dark:text-amber-400"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </DropdownMenuItem>
          )}
          {showPurge && (
            <DropdownMenuItem
              onClick={onPurge}
              className="text-destructive focus:text-destructive gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Purge
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Right-aligned Actions column header shared by registry tables. */
export function registryActionsHeader() {
  return (
    <div className="flex justify-end">
      <span className="sr-only">Actions</span>
    </div>
  );
}
