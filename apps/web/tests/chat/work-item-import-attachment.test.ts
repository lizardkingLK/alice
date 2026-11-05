import { describe, expect, it } from 'vitest';
import {
  ChatAttachmentFileTypeEnum,
  WORK_ITEM_IMPORT_UNSUPPORTED_MESSAGE,
  assertWorkItemImportAttachment,
  isWorkItemImportFileType,
} from '@repo/types';

describe('work-item import attachment gates', () => {
  it('accepts json and csv detections', () => {
    expect(isWorkItemImportFileType(ChatAttachmentFileTypeEnum.Json)).toBe(
      true
    );
    expect(isWorkItemImportFileType(ChatAttachmentFileTypeEnum.Csv)).toBe(true);
    expect(
      assertWorkItemImportAttachment('items.json', 'application/json')
    ).toBe(ChatAttachmentFileTypeEnum.Json);
    expect(assertWorkItemImportAttachment('items.csv', 'text/csv')).toBe(
      ChatAttachmentFileTypeEnum.Csv
    );
  });

  it('rejects images and other types', () => {
    expect(isWorkItemImportFileType(ChatAttachmentFileTypeEnum.Image)).toBe(
      false
    );
    expect(() =>
      assertWorkItemImportAttachment('board.png', 'image/png')
    ).toThrow(WORK_ITEM_IMPORT_UNSUPPORTED_MESSAGE);
    expect(() =>
      assertWorkItemImportAttachment('notes.md', 'text/markdown')
    ).toThrow(WORK_ITEM_IMPORT_UNSUPPORTED_MESSAGE);
  });
});
