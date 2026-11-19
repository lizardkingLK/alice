'use client';

import { useCallback, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { PanelLeft } from '@repo/ui/lib/icons';
import { NotesEditor } from '@/app/notes/_components/notes-editor';
import { NotesEmptyState } from '@/app/notes/_components/notes-empty-state';
import { NotesSidebar } from '@/app/notes/_components/notes-sidebar';
import {
  addNote,
  NOTES_MAX,
  removeNote,
  updateNote,
  type NotePatch,
} from '@/app/notes/_helpers/notes-storage';
import { writeNotesSidebarOpen } from '@/app/notes/_helpers/notes-sidebar-storage';
import {
  resolveSelectedNoteId,
  useNotesPersistence,
} from '@/app/notes/_hooks/use-notes-persistence';

type NotesWorkspaceProps = {
  readonly userId: string;
  readonly initialSidebarOpen?: boolean;
};

export function NotesWorkspace({
  userId,
  initialSidebarOpen = true,
}: Readonly<NotesWorkspaceProps>) {
  const {
    notes,
    setNotes,
    selectedId,
    setSelectedId,
    flushPersist,
    schedulePersist,
  } = useNotesPersistence({ userId, trackSelection: true });
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);

  const selected =
    notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      const next = !open;
      writeNotesSidebarOpen(next);
      return next;
    });
  }, []);

  const handleCreate = () => {
    if (notes.length >= NOTES_MAX) {
      return;
    }
    const next = addNote(notes);
    const created = next[0];
    setNotes(next);
    setSelectedId(created?.id ?? null);
    flushPersist(next);
  };

  const handleDelete = (id: string) => {
    const next = removeNote(notes, id);
    setNotes(next);
    setSelectedId(
      resolveSelectedNoteId(selectedId === id ? null : selectedId, next)
    );
    flushPersist(next);
  };

  const handlePatch = (id: string, patch: NotePatch) => {
    const next = updateNote(notes, id, patch);
    setNotes(next);
    schedulePersist(next);
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {sidebarOpen ? (
        <NotesSidebar
          notes={notes}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onCollapse={handleToggleSidebar}
        />
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
        {!sidebarOpen ? (
          <div className="mb-2 flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Show drafts"
                  aria-expanded={false}
                  aria-controls="notes-drafts-sidebar"
                  onClick={handleToggleSidebar}
                >
                  <PanelLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Show drafts</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
        {selected ? (
          <NotesEditor
            key={selected.id}
            note={selected}
            variant="page"
            onPatch={(patch) => handlePatch(selected.id, patch)}
          />
        ) : (
          <NotesEmptyState onCreate={handleCreate} />
        )}
      </div>
    </div>
  );
}
