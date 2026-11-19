'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { ExternalLink, Plus } from '@repo/ui/lib/icons';
import { DashboardWidgetShell } from '@/app/dashboard/_components/dashboard-widget-shell';
import { PRODUCTIVITY_WIDGET_CATALOG } from '@/app/dashboard/_components/productivity/productivity-catalog';
import { NotesEditor } from '@/app/notes/_components/notes-editor';
import { NotesEmptyState } from '@/app/notes/_components/notes-empty-state';
import {
  addNote,
  getLastEditedNote,
  NOTES_MAX,
  updateNote,
  type NotePatch,
} from '@/app/notes/_helpers/notes-storage';
import { useNotesPersistence } from '@/app/notes/_hooks/use-notes-persistence';

const NOTES_META = PRODUCTIVITY_WIDGET_CATALOG.find(
  (widget) => widget.id === 'notes'
);

type NotesWidgetProps = {
  readonly userId: string;
};

export function NotesWidget({ userId }: Readonly<NotesWidgetProps>) {
  const { notes, setNotes, flushPersist, schedulePersist } =
    useNotesPersistence({ userId });

  const active = getLastEditedNote(notes);

  const handleCreate = () => {
    if (notes.length >= NOTES_MAX) {
      return;
    }
    const next = addNote(notes);
    setNotes(next);
    flushPersist(next);
  };

  const handlePatch = (id: string, patch: NotePatch) => {
    const next = updateNote(notes, id, patch);
    setNotes(next);
    schedulePersist(next);
  };

  const title = NOTES_META?.title ?? 'Notes';
  const description = NOTES_META?.description || undefined;
  const atCapacity = notes.length >= NOTES_MAX;

  return (
    <DashboardWidgetShell
      variant="glass"
      title={title}
      description={description}
      contentClassName="px-0 pb-0"
      headerActions={
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="New note"
                disabled={atCapacity}
                onClick={handleCreate}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {atCapacity ? `Limit of ${NOTES_MAX} notes` : 'New note'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
              >
                <Link href="/notes" aria-label="Open full Notes">
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Full Notes</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden border-t px-3 pt-3 pb-2">
        {active ? (
          <NotesEditor
            key={active.id}
            note={active}
            variant="widget"
            onPatch={(patch) => handlePatch(active.id, patch)}
          />
        ) : (
          <NotesEmptyState
            onCreate={handleCreate}
            className="px-2"
            iconClassName="size-8"
          />
        )}
      </div>
    </DashboardWidgetShell>
  );
}
