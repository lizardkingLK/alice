import {
  deleteWorkItemAttachment,
  uploadWorkItemAttachment,
} from '@/app/attachments/_services/attachments.mutations.client';
import {
  noteMarkdownFilename,
  noteSyncFingerprint,
  noteToMarkdown,
} from '@/app/notes/_helpers/notes-markdown';
import type {
  Note,
  NoteWorkItemLink,
} from '@/app/notes/_helpers/notes-storage';
import type { NotesWorkItemOption } from '@/app/notes/_services/notes-work-items.client';

function noteMarkdownFile(note: Note): File {
  const markdown = noteToMarkdown(note);
  return new File([markdown], noteMarkdownFilename(note), {
    type: 'text/markdown',
  });
}

function linkFromUpload(
  note: Note,
  item: Pick<NotesWorkItemOption, 'id' | 'key'>,
  attachmentId: string,
  attachmentUpdatedAt: string
): NoteWorkItemLink {
  return {
    workItemId: item.id,
    workItemKey: item.key,
    attachmentId,
    attachmentUpdatedAt,
    syncedFingerprint: noteSyncFingerprint(note),
    syncedAt: Date.now(),
  };
}

async function uploadNoteMarkdown(
  note: Note,
  workItemId: string
): Promise<{ attachmentId: string; attachmentUpdatedAt: string }> {
  const result = await uploadWorkItemAttachment(
    noteMarkdownFile(note),
    workItemId
  );
  const attachment = result.attachment;
  if (!attachment?.id || !attachment.updated_at) {
    throw new Error('Upload finished without attachment metadata.');
  }
  return {
    attachmentId: attachment.id,
    attachmentUpdatedAt: attachment.updated_at,
  };
}

/** First attach: upload markdown and return link metadata. */
export async function attachNoteToWorkItem(
  note: Note,
  item: NotesWorkItemOption
): Promise<NoteWorkItemLink> {
  const uploaded = await uploadNoteMarkdown(note, item.id);
  return linkFromUpload(
    note,
    item,
    uploaded.attachmentId,
    uploaded.attachmentUpdatedAt
  );
}

/**
 * Sync: upload a new markdown file, then soft-delete the previous attachment.
 * If delete fails after upload, the new link is still returned (orphan old file).
 */
export async function syncNoteToWorkItem(
  note: Note
): Promise<NoteWorkItemLink> {
  const link = note.workItemLink;
  if (!link) {
    throw new Error('This note is not attached to a work item.');
  }
  const uploaded = await uploadNoteMarkdown(note, link.workItemId);
  try {
    await deleteWorkItemAttachment(link.attachmentId, link.attachmentUpdatedAt);
  } catch {
    // Keep the new file linked; previous file may remain until cleaned up.
  }
  return linkFromUpload(
    note,
    { id: link.workItemId, key: link.workItemKey },
    uploaded.attachmentId,
    uploaded.attachmentUpdatedAt
  );
}
