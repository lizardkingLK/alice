/**
 * Per-user Notes (browser localStorage only).
 * Shared by `/notes` and the Overview Notes widget.
 */

import type { JSONContent } from '@tiptap/react';
import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX_V1 = 'alice:overview-notes:v1:';
const STORAGE_PREFIX = 'alice:overview-notes:v2:';
export const NOTES_CHANGED_EVENT = 'alice-overview-notes-changed';
export const NOTES_MAX = 30;
export const NOTE_TITLE_MAX = 120;
/** Soft guard on serialized TipTap JSON length. */
export const NOTE_CONTENT_JSON_MAX = 100_000;

export type NoteWorkItemLink = {
  readonly workItemId: string;
  readonly workItemKey: string | null;
  readonly attachmentId: string;
  /** Optimistic-lock timestamp for soft-deleting the previous attachment. */
  readonly attachmentUpdatedAt: string;
  readonly syncedFingerprint: string;
  readonly syncedAt: number;
};

export type Note = {
  readonly id: string;
  readonly title: string;
  readonly icon: string | null;
  readonly coverDataUrl: string | null;
  readonly content: JSONContent;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastEditedAt: number;
  readonly workItemLink: NoteWorkItemLink | null;
};

export type NotePatch = {
  readonly title?: string;
  readonly icon?: string | null;
  readonly coverDataUrl?: string | null;
  readonly content?: JSONContent;
  readonly workItemLink?: NoteWorkItemLink | null;
  /** When true, bump lastEditedAt (content/title/icon edits). */
  readonly touchEdited?: boolean;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function storageKeyV1(userId: string): string {
  return `${STORAGE_PREFIX_V1}${userId}`;
}

function newNoteId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    return `note-${Date.now()}-${suffix}`;
  }
  return `note-${Date.now()}`;
}

function clampTitle(value: string): string {
  return value.slice(0, NOTE_TITLE_MAX);
}

export function emptyNoteDoc(): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

function plainTextToDoc(body: string): JSONContent {
  const trimmed = body.trim();
  if (!trimmed) {
    return emptyNoteDoc();
  }
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: trimmed.slice(0, 8_000) }],
      },
    ],
  };
}

function isJsonContent(value: unknown): value is JSONContent {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clampContent(content: JSONContent): JSONContent {
  const serialized = JSON.stringify(content);
  if (serialized.length <= NOTE_CONTENT_JSON_MAX) {
    return content;
  }
  return emptyNoteDoc();
}

function normalizeWorkItemLink(value: unknown): NoteWorkItemLink | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.workItemId !== 'string' || row.workItemId.length === 0) {
    return null;
  }
  if (typeof row.attachmentId !== 'string' || row.attachmentId.length === 0) {
    return null;
  }
  if (
    typeof row.attachmentUpdatedAt !== 'string' ||
    row.attachmentUpdatedAt.length === 0
  ) {
    return null;
  }
  if (
    typeof row.syncedFingerprint !== 'string' ||
    typeof row.syncedAt !== 'number' ||
    !Number.isFinite(row.syncedAt)
  ) {
    return null;
  }
  return {
    workItemId: row.workItemId,
    workItemKey:
      typeof row.workItemKey === 'string' && row.workItemKey.length > 0
        ? row.workItemKey
        : null,
    attachmentId: row.attachmentId,
    attachmentUpdatedAt: row.attachmentUpdatedAt,
    syncedFingerprint: row.syncedFingerprint,
    syncedAt: row.syncedAt,
  };
}

function normalizeOptionalString(
  value: unknown,
  maxLength?: number
): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return maxLength === undefined ? trimmed : trimmed.slice(0, maxLength);
}

function normalizeFiniteTime(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function normalizeNoteContent(row: Record<string, unknown>): JSONContent {
  if (isJsonContent(row.content)) {
    return clampContent(row.content);
  }
  if (typeof row.body === 'string') {
    return plainTextToDoc(row.body);
  }
  return emptyNoteDoc();
}

function normalizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id.length === 0) {
    return null;
  }
  const createdAt = normalizeFiniteTime(row.createdAt, Date.now());
  const updatedAt = normalizeFiniteTime(row.updatedAt, createdAt);
  return {
    id: row.id,
    title: typeof row.title === 'string' ? clampTitle(row.title) : '',
    icon: normalizeOptionalString(row.icon, 8),
    coverDataUrl: normalizeOptionalString(row.coverDataUrl),
    content: normalizeNoteContent(row),
    createdAt,
    updatedAt,
    lastEditedAt: normalizeFiniteTime(row.lastEditedAt, updatedAt),
    workItemLink: normalizeWorkItemLink(row.workItemLink),
  };
}

function sortNotesByLastEdited(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => b.lastEditedAt - a.lastEditedAt);
}

function serializeNote(note: Note): Note {
  return {
    id: note.id,
    title: clampTitle(note.title),
    icon: note.icon,
    coverDataUrl: note.coverDataUrl,
    content: clampContent(note.content),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    lastEditedAt: note.lastEditedAt,
    workItemLink: note.workItemLink,
  };
}

function readRawNotes(userId: string): Note[] {
  const rawV2 = getLocalStorageJson(storageKey(userId));
  if (Array.isArray(rawV2)) {
    const notes: Note[] = [];
    for (const entry of rawV2) {
      const note = normalizeNote(entry);
      if (note) {
        notes.push(note);
      }
      if (notes.length >= NOTES_MAX) {
        break;
      }
    }
    return sortNotesByLastEdited(notes);
  }

  const rawV1 = getLocalStorageJson(storageKeyV1(userId));
  if (!Array.isArray(rawV1)) {
    return [];
  }
  const migrated: Note[] = [];
  for (const entry of rawV1) {
    const note = normalizeNote(entry);
    if (note) {
      migrated.push(note);
    }
    if (migrated.length >= NOTES_MAX) {
      break;
    }
  }
  return sortNotesByLastEdited(migrated);
}

export function readNotes(userId: string | null | undefined): Note[] {
  if (!userId) {
    return [];
  }
  return readRawNotes(userId);
}

export function writeNotes(
  userId: string | null | undefined,
  notes: readonly Note[]
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(
    storageKey(userId),
    sortNotesByLastEdited(notes)
      .slice(0, NOTES_MAX)
      .map((note) => serializeNote(note))
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTES_CHANGED_EVENT));
  }
}

/** Ensure v1 notes are rewritten to v2 after first successful read+write. */
export function migrateNotesIfNeeded(
  userId: string | null | undefined
): Note[] {
  const notes = readNotes(userId);
  if (!userId || notes.length === 0) {
    return notes;
  }
  const hasV2 = Array.isArray(getLocalStorageJson(storageKey(userId)));
  if (!hasV2) {
    writeNotes(userId, notes);
  }
  return notes;
}

export function addNote(notes: readonly Note[]): Note[] {
  if (notes.length >= NOTES_MAX) {
    return [...notes];
  }
  const now = Date.now();
  const next: Note = {
    id: newNoteId(),
    title: '',
    icon: null,
    coverDataUrl: null,
    content: emptyNoteDoc(),
    createdAt: now,
    updatedAt: now,
    lastEditedAt: now,
    workItemLink: null,
  };
  return sortNotesByLastEdited([next, ...notes]);
}

export function updateNote(
  notes: readonly Note[],
  id: string,
  patch: NotePatch
): Note[] {
  let changed = false;
  const now = Date.now();
  const next = notes.map((note) => {
    if (note.id !== id) {
      return note;
    }
    const title =
      patch.title === undefined ? note.title : clampTitle(patch.title);
    const icon = patch.icon === undefined ? note.icon : patch.icon;
    const coverDataUrl =
      patch.coverDataUrl === undefined ? note.coverDataUrl : patch.coverDataUrl;
    const content =
      patch.content === undefined ? note.content : clampContent(patch.content);
    const workItemLink =
      patch.workItemLink === undefined ? note.workItemLink : patch.workItemLink;

    const sameTitle = title === note.title;
    const sameIcon = icon === note.icon;
    const sameCover = coverDataUrl === note.coverDataUrl;
    const sameContent =
      JSON.stringify(content) === JSON.stringify(note.content);
    const sameLink =
      JSON.stringify(workItemLink) === JSON.stringify(note.workItemLink);
    if (sameTitle && sameIcon && sameCover && sameContent && sameLink) {
      return note;
    }
    changed = true;
    const touchEdited =
      patch.touchEdited === true || !sameTitle || !sameIcon || !sameContent;
    return {
      ...note,
      title,
      icon,
      coverDataUrl,
      content,
      workItemLink,
      updatedAt: now,
      lastEditedAt: touchEdited ? now : note.lastEditedAt,
    };
  });
  if (!changed) {
    return [...notes];
  }
  return sortNotesByLastEdited(next);
}

export function removeNote(notes: readonly Note[], id: string): Note[] {
  return notes.filter((note) => note.id !== id);
}

export function getLastEditedNote(notes: readonly Note[]): Note | null {
  if (notes.length === 0) {
    return null;
  }
  return sortNotesByLastEdited(notes)[0] ?? null;
}

function collectText(node: JSONContent): string {
  if (typeof node.text === 'string') {
    return node.text;
  }
  if (!Array.isArray(node.content)) {
    return '';
  }
  return node.content.map((child) => collectText(child)).join(' ');
}

export function notePlainText(note: Note): string {
  return collectText(note.content).replace(/\s+/g, ' ').trim();
}

/** Display title for list rows when the note has no title yet. */
export function noteDisplayTitle(note: Note): string {
  const trimmed = note.title.trim();
  if (trimmed) {
    return trimmed;
  }
  const fromBody = notePlainText(note);
  if (fromBody) {
    return fromBody.slice(0, NOTE_TITLE_MAX);
  }
  return 'Untitled note';
}

export function notePreview(note: Note): string {
  const trimmed = notePlainText(note);
  if (!trimmed) {
    return 'No content yet';
  }
  return trimmed.slice(0, 80);
}
