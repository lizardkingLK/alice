import { describe, expect, it } from 'vitest';
import {
  noteIsDirtyAgainstLink,
  noteMarkdownFilename,
  noteSyncFingerprint,
  noteToMarkdown,
} from '@/app/notes/_helpers/notes-markdown';
import { emptyNoteDoc, type Note } from '@/app/notes/_helpers/notes-storage';

function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Sprint plan',
    icon: '📝',
    coverDataUrl: null,
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Ship notes' }],
        },
      ],
    },
    createdAt: 1,
    updatedAt: 1,
    lastEditedAt: 1,
    workItemLink: null,
    ...overrides,
  };
}

describe('notes markdown', () => {
  it('exports title, icon, and body as markdown', () => {
    // Arrange
    const note = buildNote();

    // Act
    const markdown = noteToMarkdown(note);

    // Assert
    expect(markdown).toContain('# 📝 Sprint plan');
    expect(markdown).toContain('Ship notes');
    expect(noteMarkdownFilename(note)).toBe('sprint-plan.md');
  });

  it('falls back for empty docs', () => {
    // Arrange
    const note = buildNote({
      title: '',
      icon: null,
      content: emptyNoteDoc(),
    });

    // Act / Assert
    expect(noteToMarkdown(note)).toBe('# Untitled note\n');
    expect(noteMarkdownFilename(note)).toBe('untitled-note.md');
  });

  it('detects dirty state against the synced fingerprint', () => {
    // Arrange
    const note = buildNote();
    const fingerprint = noteSyncFingerprint(note);
    const linked = buildNote({
      workItemLink: {
        workItemId: 'wi-1',
        workItemKey: 'ABC-1',
        attachmentId: 'att-1',
        attachmentUpdatedAt: '2026-01-01T00:00:00.000Z',
        syncedFingerprint: fingerprint,
        syncedAt: 1,
      },
    });

    // Act / Assert
    expect(noteIsDirtyAgainstLink(linked)).toBe(false);
    expect(
      noteIsDirtyAgainstLink(
        buildNote({
          title: 'Changed',
          workItemLink: linked.workItemLink,
        })
      )
    ).toBe(true);
    expect(noteIsDirtyAgainstLink(note)).toBe(false);
  });
});
