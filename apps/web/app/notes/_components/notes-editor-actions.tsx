'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Download,
  Link2,
  Link2Off,
  Loader2,
  RefreshCw,
} from '@repo/ui/lib/icons';
import { toast } from '@repo/ui/components/ui/sonner';
import { NotesAttachDialog } from '@/app/notes/_components/notes-attach-dialog';
import {
  attachNoteToWorkItem,
  syncNoteToWorkItem,
} from '@/app/notes/_helpers/notes-attach';
import {
  downloadNoteMarkdown,
  noteIsDirtyAgainstLink,
} from '@/app/notes/_helpers/notes-markdown';
import type { Note, NotePatch } from '@/app/notes/_helpers/notes-storage';
import type { NotesWorkItemOption } from '@/app/notes/_services/notes-work-items.client';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';

type NotesEditorActionsProps = {
  readonly note: Note;
  readonly variant: 'page' | 'widget';
  // eslint-disable-next-line no-unused-vars -- patch callback
  readonly onPatch: (patch: NotePatch) => void;
};

export function NotesEditorActions({
  note,
  variant,
  onPatch,
}: Readonly<NotesEditorActionsProps>) {
  const [attachOpen, setAttachOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isPage = variant === 'page';
  const dirty = noteIsDirtyAgainstLink(note);
  const link = note.workItemLink;

  const handleDownload = () => {
    downloadNoteMarkdown(note);
  };

  const runBusyAction = async (
    action: () => Promise<void>,
    successMessage: string,
    failureFallback: string
  ) => {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
    } catch (error_) {
      toast.error(error_ instanceof Error ? error_.message : failureFallback);
    } finally {
      setBusy(false);
    }
  };

  const handleAttach = (item: NotesWorkItemOption) =>
    runBusyAction(
      async () => {
        const nextLink = await attachNoteToWorkItem(note, item);
        onPatch({ workItemLink: nextLink });
        setAttachOpen(false);
      },
      'Note attached to work item',
      'Could not attach note'
    );

  const handleSync = () =>
    runBusyAction(
      async () => {
        const nextLink = await syncNoteToWorkItem(note);
        onPatch({ workItemLink: nextLink });
      },
      'Note synced to work item',
      'Could not sync note'
    );

  const handleDetach = () => {
    onPatch({ workItemLink: null });
    toast.success('Detached from work item');
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Download markdown"
              onClick={handleDownload}
            >
              <Download className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download .md</TooltipContent>
        </Tooltip>

        {isPage && !link ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="Attach to work item"
                disabled={busy}
                onClick={() => setAttachOpen(true)}
              >
                <Link2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Attach to work item</TooltipContent>
          </Tooltip>
        ) : null}

        {isPage && link ? (
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 max-w-[10rem] cursor-pointer px-2 text-xs"
            >
              <Link href={workItemDetailHref(link.workItemId)}>
                {link.workItemKey ?? 'Work item'}
              </Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Sync to work item"
                  disabled={busy || !dirty}
                  onClick={() => {
                    handleSync().catch(() => {
                      /* toast handled in runBusyAction */
                    });
                  }}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {dirty ? 'Sync changes' : 'Up to date'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Detach from work item"
                  disabled={busy}
                  onClick={handleDetach}
                >
                  <Link2Off className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Detach</TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>

      {isPage ? (
        <NotesAttachDialog
          open={attachOpen}
          onOpenChange={setAttachOpen}
          onSelect={handleAttach}
          isAttaching={busy}
        />
      ) : null}
    </>
  );
}
