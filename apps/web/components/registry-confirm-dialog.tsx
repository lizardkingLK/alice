'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';

interface RegistryConfirmDialogProps {
  readonly title: string;
  readonly subject: ReactNode;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly pendingLabel?: string;
  readonly isPending: boolean;
  readonly isSoft: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * Shared archive / hard-delete confirmation modal used by project and team registries.
 */
export function RegistryConfirmDialog({
  title,
  subject,
  detail,
  confirmLabel,
  pendingLabel = 'Processing...',
  isPending,
  isSoft,
  onCancel,
  onConfirm,
}: Readonly<RegistryConfirmDialogProps>) {
  const confirmButtonText = isPending ? (
    <>
      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
      {pendingLabel}
    </>
  ) : (
    confirmLabel
  );

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
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
            <h3 className="text-foreground text-lg font-bold">{title}</h3>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Are you sure you want to
            {isSoft ? ' archive ' : ' permanently delete '}
            <strong className="text-foreground">{subject}</strong>
            {' ?'}
          </p>
          <p className="text-muted-foreground/80 bg-muted/50 border-border/40 mt-2 rounded-lg border p-2.5 text-xs">
            {detail}
          </p>
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
            onClick={onConfirm}
            className="bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            {confirmButtonText}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
