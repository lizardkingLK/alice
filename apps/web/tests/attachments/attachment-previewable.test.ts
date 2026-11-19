import { describe, expect, it } from 'vitest';
import {
  isAttachmentPreviewable,
  isMarkdownAttachment,
} from '@/app/work-items/_helpers/attachment-file-icon';

describe('attachment previewable helpers', () => {
  it('treats images and PDFs as previewable', () => {
    expect(isAttachmentPreviewable('image/png', 'shot.png')).toBe(true);
    expect(isAttachmentPreviewable('application/pdf', 'spec.pdf')).toBe(true);
  });

  it('detects markdown by MIME or .md extension', () => {
    expect(isMarkdownAttachment('text/markdown', 'note.md')).toBe(true);
    expect(isMarkdownAttachment('application/octet-stream', 'note.md')).toBe(
      true
    );
    expect(isMarkdownAttachment('text/plain', 'readme.txt')).toBe(false);
    expect(isAttachmentPreviewable('text/markdown', 'from-notes.md')).toBe(
      true
    );
    expect(
      isAttachmentPreviewable('application/octet-stream', 'from-notes.md')
    ).toBe(true);
  });
});
