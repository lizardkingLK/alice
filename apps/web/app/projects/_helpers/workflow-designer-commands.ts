export type WorkflowDesignerCommandId =
  | 'addState'
  | 'copyState'
  | 'cutState'
  | 'pasteState'
  | 'undo'
  | 'deleteSelection'
  | 'clearSelection';

export type WorkflowDesignerCommand = {
  readonly id: WorkflowDesignerCommandId;
  readonly label: string;
  readonly keys: string;
  readonly description: string;
  /** Render a separator above this item in the canvas context menu. */
  readonly separatorBefore?: boolean;
  /** When true, command is disabled unless the user can edit. */
  readonly requiresEdit?: boolean;
  /** When true, command needs a selected state or transition. */
  readonly requiresSelection?: boolean;
  /** When true, command needs a selected state (not an edge). */
  readonly requiresStateSelection?: boolean;
  /** When true, command needs a designer clipboard payload. */
  readonly requiresClipboard?: boolean;
};

/**
 * Shared command + shortcut catalog for Help, context menu, and docs.
 * Add-state uses Ctrl/Cmd+Alt+N because Ctrl/Cmd+N is reserved by browsers.
 */
export const WORKFLOW_DESIGNER_COMMANDS: readonly WorkflowDesignerCommand[] = [
  {
    id: 'addState',
    label: 'Add state',
    keys: 'Ctrl/Cmd + Alt + N',
    description: 'Add a new state and open Settings.',
    requiresEdit: true,
  },
  {
    id: 'copyState',
    label: 'Copy state',
    keys: 'Ctrl/Cmd + C',
    description: 'Copy the selected state (transitions are not kept).',
    separatorBefore: true,
    requiresEdit: true,
    requiresStateSelection: true,
  },
  {
    id: 'cutState',
    label: 'Cut state',
    keys: 'Ctrl/Cmd + X',
    description: 'Cut the selected state (transitions are not kept).',
    requiresEdit: true,
    requiresStateSelection: true,
  },
  {
    id: 'pasteState',
    label: 'Paste state',
    keys: 'Ctrl/Cmd + V',
    description: 'Paste a copied or cut state as a new state (no edges).',
    requiresEdit: true,
    requiresClipboard: true,
  },
  {
    id: 'undo',
    label: 'Undo',
    keys: 'Ctrl/Cmd + Z',
    description: 'Undo the last designer change.',
    separatorBefore: true,
    requiresEdit: true,
  },
  {
    id: 'deleteSelection',
    label: 'Delete',
    keys: 'Delete / Backspace',
    description: 'Delete the selected state or transition without confirming.',
    separatorBefore: true,
    requiresEdit: true,
    requiresSelection: true,
  },
  {
    id: 'clearSelection',
    label: 'Clear selection',
    keys: 'Esc',
    description: 'Clear the selected state or transition.',
  },
];
