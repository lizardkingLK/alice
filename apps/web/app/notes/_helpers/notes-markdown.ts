import type { JSONContent } from '@tiptap/react';
import { instructionsDocToMarkdown } from '@/app/chat/_helpers/chat-agent-instructions-markdown';
import {
  noteDisplayTitle,
  type Note,
} from '@/app/notes/_helpers/notes-storage';

/** Stable fingerprint of note fields that matter for sync / dirty state. */
export function noteSyncFingerprint(note: Note): string {
  return [
    note.title,
    note.icon ?? '',
    note.coverDataUrl ?? '',
    JSON.stringify(note.content),
  ].join('\0');
}

export function noteIsDirtyAgainstLink(note: Note): boolean {
  if (!note.workItemLink) {
    return false;
  }
  return noteSyncFingerprint(note) !== note.workItemLink.syncedFingerprint;
}

/** TipTap JSON (+ title/icon) → markdown file body. */
export function noteToMarkdown(note: Note): string {
  const title = noteDisplayTitle(note);
  const heading = note.icon ? `${note.icon} ${title}` : title;
  const body = instructionsDocToMarkdown(note.content as JSONContent);
  if (!body) {
    return `# ${heading}\n`;
  }
  return `# ${heading}\n\n${body}\n`;
}

export function noteMarkdownFilename(note: Note): string {
  const raw = noteDisplayTitle(note).toLowerCase();
  const parts: string[] = [];
  let current = '';
  for (const char of raw) {
    if (/[a-z0-9]/.test(char)) {
      current += char;
    } else if (current) {
      parts.push(current);
      current = '';
    }
  }
  if (current) {
    parts.push(current);
  }
  const base = parts.join('-').slice(0, 60);
  return `${base || 'untitled-note'}.md`;
}

export function downloadNoteMarkdown(note: Note): void {
  const markdown = noteToMarkdown(note);
  const filename = noteMarkdownFilename(note);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
