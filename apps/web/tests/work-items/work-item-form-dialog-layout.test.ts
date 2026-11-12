import { describe, expect, it } from 'vitest';
import {
  isWorkItemFormDetailLayout,
  isWorkItemFormModalLayout,
  isWorkItemFormNonModalLayout,
  workItemFormDialogLayoutClassName,
} from '@/app/work-items/_components/work-item-form/work-item-form-dialog-layout';

describe('workItemFormDialogLayoutClassName', () => {
  it('uses centered modern width by default', () => {
    const className = workItemFormDialogLayoutClassName('center', true);
    expect(className).toContain('sm:max-w-4xl');
    expect(className).not.toContain('w-screen');
  });

  it('floats as a bottom-right card', () => {
    const className = workItemFormDialogLayoutClassName('floating', true);
    expect(className).toContain('bottom-4');
    expect(className).toContain('right-4');
    expect(className).toContain('sm:max-w-[28rem]');
    expect(className).not.toContain('h-[100dvh]');
  });

  it('minimizes to a compact bottom-right shell without circle morph', () => {
    const className = workItemFormDialogLayoutClassName('minimized', true);
    expect(className).toContain('bottom-4');
    expect(className).toContain('rounded-xl');
    expect(className).not.toContain('rounded-full');
    expect(className).toContain('h-auto');
  });

  it('expands to a large centered panel (not viewport fullscreen)', () => {
    const className = workItemFormDialogLayoutClassName('fullscreen', true);
    expect(className).toContain('sm:max-w-[48rem]');
    expect(className).toContain('h-[min(92dvh,56rem)]');
    expect(className).toContain('rounded-xl');
    expect(className).not.toContain('w-screen');
    expect(className).not.toContain('rounded-none');
  });
});

describe('layout helpers', () => {
  it('marks modal vs non-modal layouts', () => {
    expect(isWorkItemFormModalLayout('center')).toBe(true);
    expect(isWorkItemFormModalLayout('fullscreen')).toBe(true);
    expect(isWorkItemFormModalLayout('floating')).toBe(false);
    expect(isWorkItemFormNonModalLayout('floating')).toBe(true);
    expect(isWorkItemFormNonModalLayout('minimized')).toBe(true);
    expect(isWorkItemFormNonModalLayout('center')).toBe(false);
  });

  it('uses detail rows for expanded modal and floating', () => {
    expect(isWorkItemFormDetailLayout('fullscreen')).toBe(true);
    expect(isWorkItemFormDetailLayout('floating')).toBe(true);
    expect(isWorkItemFormDetailLayout('center')).toBe(false);
    expect(isWorkItemFormDetailLayout('minimized')).toBe(false);
  });
});
