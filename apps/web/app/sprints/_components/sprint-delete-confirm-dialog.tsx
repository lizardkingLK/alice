'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  type DeleteSprintWorkItemsAction,
  DeleteSprintWorkItemsActionEnum,
} from '@repo/types';

export interface SprintDeleteConfirmDialogProps {
  readonly sprintName: string;
  readonly isPending: boolean;
  readonly onCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onConfirm: (action: DeleteSprintWorkItemsAction) => void;
}

/**
 * Shared hard-delete confirmation modal for sprints, matching the project
 * archive and purge modal format, with a permanent deletion notice for work items.
 */
export function SprintDeleteConfirmDialog({
  sprintName,
  isPending,
  onCancel,
  onConfirm,
}: Readonly<SprintDeleteConfirmDialogProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="animate-in fade-in fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
      <dialog
        open
        className="bg-card border-border animate-in fade-in zoom-in-95 relative block w-full max-w-md overflow-hidden rounded-xl border shadow-2xl duration-200"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3 text-rose-500">
            <div className="rounded-full border border-rose-500/20 bg-rose-500/10 p-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-foreground text-lg font-bold">
              Permanently Delete Sprint
            </h3>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-foreground">{sprintName}</strong>?
          </p>
          <p className="text-muted-foreground/80 bg-muted/50 border-border/40 mt-2 rounded-lg border p-2.5 text-xs">
            Warning: This action is irreversible. The sprint will be permanently
            purged from the database.
          </p>

          <div className="border-rose-500/30 bg-rose-500/10 mt-4 rounded-lg border p-3">
            <p className="text-rose-600 dark:text-rose-400 text-xs font-bold">
              Delete all work-item content with sprint
            </p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
              Permanently delete all work items and their attachments, comments,
              and logs.
            </p>
          </div>
        </div>

        <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
            className="h-9 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm(DeleteSprintWorkItemsActionEnum.DeleteContent)}
            className="bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Permanently'
            )}
          </Button>
        </div>
      </dialog>
    </div>,
    document.body
  );
}
