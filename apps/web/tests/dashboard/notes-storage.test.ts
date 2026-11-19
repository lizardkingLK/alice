import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = store.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
    return true;
  },
}));

import {
  addNote,
  emptyNoteDoc,
  getLastEditedNote,
  noteDisplayTitle,
  notePreview,
  NOTES_MAX,
  NOTE_TITLE_MAX,
  readNotes,
  removeNote,
  updateNote,
  writeNotes,
} from '@/app/notes/_helpers/notes-storage';
import { resolveSelectedNoteId } from '@/app/notes/_hooks/use-notes-persistence';

describe('notes storage v2', () => {
  beforeEach(() => {
    store.clear();
  });

  it('round-trips notes for a user', () => {
    // Arrange
    const seeded = addNote([]);

    // Act
    writeNotes('user-1', seeded);

    // Assert
    expect(readNotes('user-1')).toEqual(seeded);
    expect(readNotes('user-2')).toEqual([]);
    expect(readNotes(null)).toEqual([]);
  });

  it('adds new notes at the front and ignores when at capacity', () => {
    // Arrange / Act
    let notes = addNote([]);
    notes = updateNote(notes, notes[0]!.id, { title: 'First' });
    notes = addNote(notes);

    // Assert
    expect(notes).toHaveLength(2);
    expect(notes[0]!.title).toBe('');
    expect(notes[1]!.title).toBe('First');

    for (let index = notes.length; index < NOTES_MAX + 5; index += 1) {
      notes = addNote(notes);
    }
    expect(notes).toHaveLength(NOTES_MAX);
  });

  it('updates title, icon, and content and bumps lastEditedAt', () => {
    // Arrange
    let notes = addNote([]);
    const id = notes[0]!.id;
    const createdAt = notes[0]!.createdAt;

    // Act
    notes = updateNote(notes, id, {
      title: 'a'.repeat(NOTE_TITLE_MAX + 20),
      icon: '📝',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      },
    });

    // Assert
    const note = notes.find((row) => row.id === id)!;
    expect(note.title).toHaveLength(NOTE_TITLE_MAX);
    expect(note.icon).toBe('📝');
    expect(note.content).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });
    expect(note.createdAt).toBe(createdAt);
    expect(note.lastEditedAt).toBeGreaterThanOrEqual(createdAt);
  });

  it('skips no-op updates and removes by id', () => {
    // Arrange
    let notes = addNote([]);
    notes = updateNote(notes, notes[0]!.id, { title: 'Keep' });
    const before = notes[0]!;

    // Act
    notes = updateNote(notes, before.id, { title: 'Keep' });

    // Assert
    expect(notes[0]!.updatedAt).toBe(before.updatedAt);

    notes = removeNote(notes, before.id);
    expect(notes).toHaveLength(0);
  });

  it('migrates v1 plain-body notes and sorts by lastEditedAt', () => {
    // Arrange
    store.set(
      'alice:overview-notes:v1:user-1',
      JSON.stringify([
        {
          id: 'older',
          title: 'Older',
          body: 'legacy body',
          createdAt: 1,
          updatedAt: 10,
        },
        {
          id: 'newer',
          title: 'Newer',
          body: 'hi',
          createdAt: 2,
          updatedAt: 20,
        },
      ])
    );

    // Act
    const notes = readNotes('user-1');

    // Assert
    expect(notes.map((note) => note.id)).toEqual(['newer', 'older']);
    expect(notes[0]!.content).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hi' }],
        },
      ],
    });
    expect(getLastEditedNote(notes)?.id).toBe('newer');
  });

  it('resolves selected note id after deletes and reloads', () => {
    // Arrange
    const notes = addNote(addNote([]));
    const [first, second] = notes;

    // Act / Assert
    expect(resolveSelectedNoteId(second!.id, notes)).toBe(second!.id);
    expect(resolveSelectedNoteId('missing', notes)).toBe(first!.id);
    expect(resolveSelectedNoteId(null, [])).toBeNull();
  });

  it('builds display title and preview fallbacks', () => {
    // Arrange
    const untitled = {
      id: '1',
      title: '',
      icon: null,
      coverDataUrl: null,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First line' }],
          },
        ],
      },
      createdAt: 1,
      updatedAt: 1,
      lastEditedAt: 1,
      workItemLink: null,
    };
    const empty = {
      id: '2',
      title: '  ',
      icon: null,
      coverDataUrl: null,
      content: emptyNoteDoc(),
      createdAt: 1,
      updatedAt: 1,
      lastEditedAt: 1,
      workItemLink: null,
    };
    const titled = {
      id: '3',
      title: ' Meeting ',
      icon: '📌',
      coverDataUrl: null,
      content: emptyNoteDoc(),
      createdAt: 1,
      updatedAt: 1,
      lastEditedAt: 1,
      workItemLink: null,
    };

    // Act / Assert
    expect(noteDisplayTitle(untitled)).toBe('First line');
    expect(noteDisplayTitle(empty)).toBe('Untitled note');
    expect(noteDisplayTitle(titled)).toBe('Meeting');
    expect(notePreview(untitled)).toBe('First line');
    expect(notePreview(empty)).toBe('No content yet');
  });
});
