'use client';

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  migrateNotesIfNeeded,
  NOTES_CHANGED_EVENT,
  readNotes,
  writeNotes,
  type Note,
} from '@/app/notes/_helpers/notes-storage';

const PERSIST_DEBOUNCE_MS = 300;

export function resolveSelectedNoteId(
  previous: string | null,
  notes: readonly Note[]
): string | null {
  if (previous && notes.some((note) => note.id === previous)) {
    return previous;
  }
  return notes[0]?.id ?? null;
}

type UseNotesPersistenceOptions = {
  readonly userId: string;
  /** When true, keep a selectedId in sync with reloads / creates. */
  readonly trackSelection?: boolean;
};

type UseNotesPersistenceResult = {
  readonly notes: Note[];
  readonly setNotes: Dispatch<SetStateAction<Note[]>>;
  readonly selectedId: string | null;
  readonly setSelectedId: Dispatch<SetStateAction<string | null>>;
  // eslint-disable-next-line no-unused-vars -- persist callback
  readonly flushPersist: (next: readonly Note[]) => void;
  // eslint-disable-next-line no-unused-vars -- persist callback
  readonly schedulePersist: (next: readonly Note[]) => void;
};

export function useNotesPersistence({
  userId,
  trackSelection = false,
}: UseNotesPersistenceOptions): UseNotesPersistenceResult {
  const [notes, setNotes] = useState<Note[]>(() =>
    migrateNotesIfNeeded(userId)
  );
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    trackSelection ? (migrateNotesIfNeeded(userId)[0]?.id ?? null) : null
  );
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreOwnWriteRef = useRef(false);
  const notesRef = useRef(notes);
  const selectedIdRef = useRef(selectedId);
  notesRef.current = notes;
  selectedIdRef.current = selectedId;

  const persistNotes = (next: readonly Note[]) => {
    ignoreOwnWriteRef.current = true;
    writeNotes(userId, next);
  };

  const flushPersist = (next: readonly Note[]) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistNotes(next);
  };

  const schedulePersist = (next: readonly Note[]) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistNotes(next);
    }, PERSIST_DEBOUNCE_MS);
  };

  useEffect(() => {
    const reload = () => {
      if (ignoreOwnWriteRef.current) {
        ignoreOwnWriteRef.current = false;
        return;
      }
      const next = readNotes(userId);
      setNotes(next);
      if (trackSelection) {
        setSelectedId(resolveSelectedNoteId(selectedIdRef.current, next));
      }
    };
    window.addEventListener(NOTES_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(NOTES_CHANGED_EVENT, reload);
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        ignoreOwnWriteRef.current = true;
        writeNotes(userId, notesRef.current);
      }
    };
  }, [trackSelection, userId]);

  return {
    notes,
    setNotes,
    selectedId,
    setSelectedId,
    flushPersist,
    schedulePersist,
  };
}
