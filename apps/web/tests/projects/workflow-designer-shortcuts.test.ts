import { describe, expect, it, vi } from 'vitest';
import {
  handleWorkflowDesignerKeydown,
  type WorkflowDesignerShortcutHandlers,
} from '@/app/projects/_helpers/workflow-designer-shortcuts';

function keyEvent(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

function handlers(
  overrides: Partial<WorkflowDesignerShortcutHandlers> = {}
): WorkflowDesignerShortcutHandlers {
  return {
    clearSelection: () => undefined,
    undo: () => undefined,
    addState: () => undefined,
    copyState: () => undefined,
    cutState: () => undefined,
    pasteState: () => undefined,
    deleteSelection: () => undefined,
    ...overrides,
  };
}

describe('workflow-designer-shortcuts', () => {
  it('clears selection on Escape when not typing', () => {
    // Arrange
    const clearSelection = vi.fn();

    // Act
    const handled = handleWorkflowDesignerKeydown(keyEvent({ key: 'Escape' }), {
      canEdit: true,
      manageBusy: false,
      hasSelection: true,
      handlers: handlers({ clearSelection }),
    });

    // Assert
    expect(handled).toBe(true);
    expect(clearSelection).toHaveBeenCalledOnce();
  });

  it('routes Ctrl+Alt+N to addState', () => {
    // Arrange
    const addState = vi.fn();
    const event = keyEvent({ key: 'n', ctrlKey: true, altKey: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    // Act
    handleWorkflowDesignerKeydown(event, {
      canEdit: true,
      manageBusy: false,
      hasSelection: false,
      handlers: handlers({ addState }),
    });

    // Assert
    expect(preventDefault).toHaveBeenCalled();
    expect(addState).toHaveBeenCalledOnce();
  });

  it('does not treat Ctrl+N alone as addState', () => {
    // Arrange
    const addState = vi.fn();
    const event = keyEvent({ key: 'n', ctrlKey: true });

    // Act
    const handled = handleWorkflowDesignerKeydown(event, {
      canEdit: true,
      manageBusy: false,
      hasSelection: false,
      handlers: handlers({ addState }),
    });

    // Assert
    expect(handled).toBe(false);
    expect(addState).not.toHaveBeenCalled();
  });

  it('routes Ctrl+C to copyState', () => {
    // Arrange
    const copyState = vi.fn();
    const event = keyEvent({ key: 'c', ctrlKey: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    // Act
    handleWorkflowDesignerKeydown(event, {
      canEdit: true,
      manageBusy: false,
      hasSelection: true,
      handlers: handlers({ copyState }),
    });

    // Assert
    expect(preventDefault).toHaveBeenCalled();
    expect(copyState).toHaveBeenCalledOnce();
  });

  it('deletes selection on Delete when something is selected', () => {
    // Arrange
    const deleteSelection = vi.fn();

    // Act
    handleWorkflowDesignerKeydown(keyEvent({ key: 'Delete' }), {
      canEdit: true,
      manageBusy: false,
      hasSelection: true,
      handlers: handlers({ deleteSelection }),
    });

    // Assert
    expect(deleteSelection).toHaveBeenCalledOnce();
  });
});
