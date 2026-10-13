import { describe, expect, it, vi } from 'vitest';
import { handleWorkflowDesignerKeydown } from '@/app/projects/_helpers/workflow-designer-shortcuts';

function keyEvent(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('workflow-designer-shortcuts', () => {
  it('clears selection on Escape when not typing', () => {
    const clearSelection = vi.fn();
    const handled = handleWorkflowDesignerKeydown(keyEvent({ key: 'Escape' }), {
      canEdit: true,
      manageBusy: false,
      hasSelection: true,
      handlers: {
        clearSelection,
        undo: vi.fn(),
        addState: vi.fn(),
        cutState: vi.fn(),
        pasteState: vi.fn(),
        deleteSelection: vi.fn(),
      },
    });
    expect(handled).toBe(true);
    expect(clearSelection).toHaveBeenCalledOnce();
  });

  it('routes Ctrl+N to addState', () => {
    const addState = vi.fn();
    const event = keyEvent({ key: 'n', ctrlKey: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    handleWorkflowDesignerKeydown(event, {
      canEdit: true,
      manageBusy: false,
      hasSelection: false,
      handlers: {
        clearSelection: vi.fn(),
        undo: vi.fn(),
        addState,
        cutState: vi.fn(),
        pasteState: vi.fn(),
        deleteSelection: vi.fn(),
      },
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(addState).toHaveBeenCalledOnce();
  });

  it('deletes selection on Delete when something is selected', () => {
    const deleteSelection = vi.fn();
    handleWorkflowDesignerKeydown(keyEvent({ key: 'Delete' }), {
      canEdit: true,
      manageBusy: false,
      hasSelection: true,
      handlers: {
        clearSelection: vi.fn(),
        undo: vi.fn(),
        addState: vi.fn(),
        cutState: vi.fn(),
        pasteState: vi.fn(),
        deleteSelection,
      },
    });
    expect(deleteSelection).toHaveBeenCalledOnce();
  });
});
