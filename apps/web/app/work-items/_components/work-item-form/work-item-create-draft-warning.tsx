'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';

type WorkItemCreateDraftWarningProps = {
  readonly open: boolean;
  readonly onKeepEditing: () => void;
  readonly onDiscardDraft: () => void;
};

/**
 * Jira-like “draft already in progress” gate when Create is clicked again
 * while a modern create dialog is still open (including floating / minimized).
 */
export function WorkItemCreateDraftWarning({
  open,
  onKeepEditing,
  onDiscardDraft,
}: Readonly<WorkItemCreateDraftWarningProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      onKeepEditing();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onKeepEditing]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="work-item-draft-warning-title"
        aria-describedby="work-item-draft-warning-desc"
        className="bg-card border-border relative z-10 w-full max-w-md overflow-hidden rounded-xl border shadow-2xl"
      >
        <div className="flex items-start gap-3 p-6">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="min-w-0 space-y-2">
            <h2
              id="work-item-draft-warning-title"
              className="text-base leading-none font-semibold"
            >
              Draft work item in progress
            </h2>
            <p
              id="work-item-draft-warning-desc"
              className="text-muted-foreground text-sm"
            >
              It looks like you&apos;re already creating a work item. Creating a
              new one will discard your draft and any changes you&apos;ve made
              won&apos;t be saved.
            </p>
          </div>
        </div>
        <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="ghost" onClick={onDiscardDraft}>
            Discard draft
          </Button>
          <Button type="button" onClick={onKeepEditing}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
