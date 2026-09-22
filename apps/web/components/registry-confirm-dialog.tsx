'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  /**
   * Verb used in “Are you sure you want to …?”.
   * Defaults to archive (soft) or permanently delete (hard).
   */
  readonly actionVerb?: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * Shared archive / restore / hard-delete confirmation modal used by registries.
 * Portaled to `document.body` so the backdrop covers the full viewport even
 * when opened from inside the dashboard scroll shell (`overflow-y-auto`).
 *
 * Prefer opening this *after* a Radix dropdown has closed (`afterDialogClose`)
 * so body `pointer-events` / scroll-lock from the menu are released first.
 */
export function RegistryConfirmDialog({
  title,
  subject,
  detail,
  confirmLabel,
  pendingLabel = 'Processing...',
  isPending,
  isSoft,
  actionVerb,
  onCancel,
  onConfirm,
}: Readonly<RegistryConfirmDialogProps>) {
  const [mounted, setMounted] = useState(false);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  const confirmLockRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    confirmLockRef.current = false;
  }, [isPending]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isPending) {
        return;
      }
      event.preventDefault();
      onCancelRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPending]);

  const confirmButtonText = isPending ? (
    <>
      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
      {pendingLabel}
    </>
  ) : (
    confirmLabel
  );
  const verb = actionVerb ?? (isSoft ? 'archive' : 'permanently delete');

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="animate-in fade-in fixed inset-0 z-[200] flex items-center justify-center p-4 duration-200">
      <button
        type="button"
        aria-label="Dismiss"
        disabled={isPending}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm disabled:cursor-not-allowed"
        onClick={() => {
          if (!isPending) {
            onCancelRef.current();
          }
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="registry-confirm-title"
        className="bg-card border-border animate-in fade-in zoom-in-95 relative z-10 block w-full max-w-md overflow-hidden rounded-xl border shadow-2xl duration-200"
      >
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3 text-rose-500">
            <div className="rounded-full border border-rose-500/20 bg-rose-500/10 p-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3
              id="registry-confirm-title"
              className="text-foreground text-lg font-bold"
            >
              {title}
            </h3>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Are you sure you want to {verb}{' '}
            <strong className="text-foreground">{subject}</strong>
            {'?'}
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
            onClick={() => onCancelRef.current()}
            className="h-9 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (isPending || confirmLockRef.current) {
                return;
              }
              confirmLockRef.current = true;
              onConfirmRef.current();
            }}
            className="bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            {confirmButtonText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
