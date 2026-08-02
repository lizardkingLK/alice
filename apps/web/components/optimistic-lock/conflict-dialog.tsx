'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import type { ConflictSession } from '@/components/optimistic-lock/optimistic-lock-provider';
import { clearOptimisticPending } from '@/lib/optimistic-lock/pending-storage';
import type { Json } from '@repo/types';
import { formatDateTime, formatRelativeTime } from '@/app/_shared/utility';
import {
  nodeToPlainText,
  toTiptapContent,
} from '@/app/work-items/_helpers/work-item-description';

type FieldChoice = 'mine' | 'theirs';

type OptimisticLockConflictDialogProps = {
  readonly session: ConflictSession | null;
  readonly onResolved: () => void;
};

const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  title: 'Title',
  status: 'Status',
  assignee_id: 'Assignee',
  reporter_id: 'Reporter',
  due_date: 'Due date',
  sprint_id: 'Sprint',
  story_points: 'Story points',
  parent_id: 'Parent',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replaceAll('_', ' ');
}

function asDescriptionJson(value: unknown): Json | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as Json;
    } catch {
      return trimmed;
    }
  }
  if (typeof value === 'object') {
    return value as Json;
  }
  return null;
}

function isRichTextField(field: string, value: unknown): boolean {
  if (field === 'description' || field === 'content') {
    return true;
  }
  const json = asDescriptionJson(value);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return false;
  }
  return 'type' in json && (json.type === 'doc' || json.type === 'paragraph');
}

function formatDescriptionValue(value: unknown): string {
  const json = asDescriptionJson(value);
  const doc = toTiptapContent(json);
  if (doc) {
    const text = nodeToPlainText(doc).trim();
    return text || '—';
  }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const text = nodeToPlainText(json).trim();
    return text || '—';
  }
  if (typeof json === 'string' && json.trim()) {
    return json.trim();
  }
  return '—';
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (isRichTextField(field, value)) {
    return formatDescriptionValue(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function OptimisticLockConflictDialog({
  session,
  onResolved,
}: OptimisticLockConflictDialogProps) {
  const fieldKeys = useMemo(
    () => (session ? Object.keys(session.pendingFields) : []),
    [session]
  );

  const [choices, setChoices] = useState<Record<string, FieldChoice>>({});
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!session) {
      setChoices({});
      resolvedRef.current = false;
      return;
    }
    const initial: Record<string, FieldChoice> = {};
    for (const key of Object.keys(session.pendingFields)) {
      initial[key] = 'mine';
    }
    setChoices(initial);
  }, [session]);

  if (!session) {
    return null;
  }

  const finish = (reload: boolean) => {
    resolvedRef.current = true;
    onResolved();
    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  /** Closing / dismissing / Take theirs = discard pending, keep server row. */
  const takeTheirs = () => {
    if (resolvedRef.current) {
      return;
    }
    clearOptimisticPending(
      session.entityType,
      session.entityId,
      session.userId
    );
    finish(true);
  };

  const keepMine = () => {
    if (resolvedRef.current) {
      return;
    }
    const detail = {
      entityType: session.entityType,
      entityId: session.entityId,
      userId: session.userId,
      expectedUpdatedAt: session.serverUpdatedAt,
      pendingFields: session.pendingFields,
      mode: 'keep-mine' as const,
    };
    window.dispatchEvent(
      new CustomEvent('alice:optimistic-lock-resolve', { detail })
    );
    finish(false);
  };

  const applyMerge = () => {
    if (resolvedRef.current) {
      return;
    }
    const merged: Record<string, unknown> = {};
    for (const key of fieldKeys) {
      if (choices[key] === 'mine') {
        merged[key] = session.pendingFields[key];
      }
    }
    const detail = {
      entityType: session.entityType,
      entityId: session.entityId,
      userId: session.userId,
      expectedUpdatedAt: session.serverUpdatedAt,
      pendingFields: merged,
      mode: 'merge' as const,
    };
    window.dispatchEvent(
      new CustomEvent('alice:optimistic-lock-resolve', { detail })
    );
    if (Object.keys(merged).length === 0) {
      clearOptimisticPending(
        session.entityType,
        session.entityId,
        session.userId
      );
      finish(true);
      return;
    }
    finish(false);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          takeTheirs();
        }
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>This was updated by someone else</DialogTitle>
          <DialogDescription>
            Your pending edits were not applied because this record changed
            since you loaded it. Closing this dialog or refreshing keeps the
            server version and discards your pending changes.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <p className="text-muted-foreground text-xs">
            Server updated{' '}
            {session.serverUpdatedAt ? (
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hover:text-foreground cursor-pointer underline decoration-dotted underline-offset-2">
                      {formatRelativeTime(session.serverUpdatedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    {formatDateTime(session.serverUpdatedAt)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span>—</span>
            )}
          </p>
          {fieldKeys.map((key) => {
            const mine = session.pendingFields[key];
            const theirs = session.serverEntity[key];
            const choice = choices[key] ?? 'mine';
            return (
              <div
                key={key}
                className="border-border rounded-lg border p-3 text-sm"
              >
                <p className="mb-2 font-medium tracking-tight">
                  {fieldLabel(key)}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border p-2 text-left transition-colors',
                      choice === 'mine'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    )}
                    onClick={() =>
                      setChoices((prev) => ({ ...prev, [key]: 'mine' }))
                    }
                  >
                    <span className="text-muted-foreground text-xs uppercase">
                      Yours
                    </span>
                    <p
                      className={cn(
                        'mt-1 max-h-28 overflow-auto text-sm whitespace-pre-wrap',
                        isRichTextField(key, mine) ? '' : 'font-mono text-xs'
                      )}
                    >
                      {formatFieldValue(key, mine)}
                    </p>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border p-2 text-left transition-colors',
                      choice === 'theirs'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    )}
                    onClick={() =>
                      setChoices((prev) => ({ ...prev, [key]: 'theirs' }))
                    }
                  >
                    <span className="text-muted-foreground text-xs uppercase">
                      Server
                    </span>
                    <p
                      className={cn(
                        'mt-1 max-h-28 overflow-auto text-sm whitespace-pre-wrap',
                        isRichTextField(key, theirs) ? '' : 'font-mono text-xs'
                      )}
                    >
                      {formatFieldValue(key, theirs)}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={takeTheirs}>
            Take theirs
          </Button>
          <Button type="button" variant="outline" onClick={keepMine}>
            Keep mine
          </Button>
          <Button type="button" onClick={applyMerge}>
            Apply merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
