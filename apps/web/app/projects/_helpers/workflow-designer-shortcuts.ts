import {
  isWorkflowDesignerDialogOpen,
  isWorkflowDesignerEditableTarget,
} from '@/app/projects/_helpers/workflow-designer.layout';

export type WorkflowDesignerShortcutHandlers = {
  readonly clearSelection: () => void;
  readonly undo: () => void;
  readonly addState: () => void;
  readonly copyState: () => void;
  readonly cutState: () => void;
  readonly pasteState: () => void;
  readonly deleteSelection: () => void;
};

/**
 * Designer keyboard shortcuts. Returns true when the event was handled.
 * Add-state uses Ctrl/Cmd+Alt+N (Ctrl/Cmd+N opens a new browser tab/window).
 */
export function handleWorkflowDesignerKeydown(
  event: KeyboardEvent,
  options: {
    readonly canEdit: boolean;
    readonly manageBusy: boolean;
    readonly hasSelection: boolean;
    readonly handlers: WorkflowDesignerShortcutHandlers;
  }
): boolean {
  if (isWorkflowDesignerDialogOpen()) {
    return false;
  }

  if (event.key === 'Escape') {
    if (isWorkflowDesignerEditableTarget(event.target)) {
      return false;
    }
    options.handlers.clearSelection();
    return true;
  }

  if (!options.canEdit || options.manageBusy) {
    return false;
  }
  if (isWorkflowDesignerEditableTarget(event.target)) {
    return false;
  }

  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  const { handlers } = options;

  if (mod && event.altKey && !event.shiftKey && key === 'n') {
    event.preventDefault();
    handlers.addState();
    return true;
  }

  if (mod && !event.shiftKey && !event.altKey) {
    const modHandlers: Partial<Record<string, () => void>> = {
      z: handlers.undo,
      c: handlers.copyState,
      x: handlers.cutState,
      v: handlers.pasteState,
    };
    const modHandler = modHandlers[key];
    if (modHandler) {
      event.preventDefault();
      modHandler();
      return true;
    }
  }

  if (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    options.hasSelection
  ) {
    event.preventDefault();
    handlers.deleteSelection();
    return true;
  }

  return false;
}
