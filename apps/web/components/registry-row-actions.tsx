'use client';

import { Archive, Pencil, RefreshCw, Trash2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';

const ACTION_PRIMARY_CLASS =
  'flex h-8 w-20 shrink-0 cursor-pointer items-center justify-center border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 shadow-sm transition-all hover:bg-emerald-600 hover:text-white focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50';

const ACTION_SECONDARY_CLASS =
  'flex h-8 w-28 shrink-0 cursor-pointer items-center justify-center border border-rose-500/20 bg-rose-500/10 text-[11px] text-rose-600 shadow-sm transition-all hover:bg-rose-600 hover:text-white focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50';

export interface RegistryRowActionsProps {
  readonly isPending: boolean;
  readonly isManagerOrAdmin: boolean;
  readonly isAdmin: boolean;
  /** Active (non-archived) rows show Edit + Archive; archived show Restore + Purge. */
  readonly isActiveView: boolean;
  readonly onEdit: () => void;
  readonly onRestore: () => void;
  readonly onArchive: () => void;
  readonly onPurge: () => void;
}

function PrimaryAction({
  isPending,
  isManagerOrAdmin,
  isActiveView,
  onEdit,
  onRestore,
}: Readonly<
  Pick<
    RegistryRowActionsProps,
    'isPending' | 'isManagerOrAdmin' | 'isActiveView' | 'onEdit' | 'onRestore'
  >
>) {
  if (!isManagerOrAdmin) {
    return <div className="w-20 shrink-0" />;
  }

  if (isActiveView) {
    return (
      <Button
        variant="outline"
        disabled={isPending}
        onClick={onEdit}
        className={ACTION_PRIMARY_CLASS}
      >
        <Pencil className="mr-1 h-3 w-3 shrink-0" />
        <span>Edit</span>
      </Button>
    );
  }

  return (
    <Button
      disabled={isPending}
      onClick={onRestore}
      className={ACTION_PRIMARY_CLASS}
    >
      <RefreshCw className="mr-1 h-3 w-3 shrink-0" />
      <span>Restore</span>
    </Button>
  );
}

function SecondaryAction({
  isPending,
  isManagerOrAdmin,
  isAdmin,
  isActiveView,
  onArchive,
  onPurge,
}: Readonly<
  Pick<
    RegistryRowActionsProps,
    | 'isPending'
    | 'isManagerOrAdmin'
    | 'isAdmin'
    | 'isActiveView'
    | 'onArchive'
    | 'onPurge'
  >
>) {
  if (isActiveView && isManagerOrAdmin) {
    return (
      <Button
        disabled={isPending}
        onClick={onArchive}
        className={ACTION_SECONDARY_CLASS}
      >
        <Archive className="mr-1 h-3 w-3 shrink-0" />
        <span>Archive</span>
      </Button>
    );
  }

  if (!isActiveView && isAdmin) {
    return (
      <Button
        disabled={isPending}
        onClick={onPurge}
        className={ACTION_SECONDARY_CLASS}
      >
        <Trash2 className="mr-1 h-3 w-3 shrink-0" />
        <span>Purge</span>
      </Button>
    );
  }

  return <div className="w-28 shrink-0" />;
}

/** Edit / Restore / Archive / Purge action pair for registry DataTable rows. */
export function RegistryRowActions({
  isPending,
  isManagerOrAdmin,
  isAdmin,
  isActiveView,
  onEdit,
  onRestore,
  onArchive,
  onPurge,
}: Readonly<RegistryRowActionsProps>) {
  return (
    <div className="flex justify-end gap-2">
      <PrimaryAction
        isPending={isPending}
        isManagerOrAdmin={isManagerOrAdmin}
        isActiveView={isActiveView}
        onEdit={onEdit}
        onRestore={onRestore}
      />
      <SecondaryAction
        isPending={isPending}
        isManagerOrAdmin={isManagerOrAdmin}
        isAdmin={isAdmin}
        isActiveView={isActiveView}
        onArchive={onArchive}
        onPurge={onPurge}
      />
    </div>
  );
}

/** Right-aligned Actions column header shared by registry tables. */
export function registryActionsHeader() {
  return (
    <div className="flex justify-end">
      <div className="w-50 text-left">Actions</div>
    </div>
  );
}
