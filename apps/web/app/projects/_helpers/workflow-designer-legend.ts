/**
 * Designer legend entries for the Workflow Help dialog (under Keyboard).
 * Keep copy short and product-facing — deeper rules live in the user guide.
 */
export type WorkflowDesignerLegendItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
};

export const WORKFLOW_DESIGNER_LEGEND: readonly WorkflowDesignerLegendItem[] = [
  {
    id: 'state-node',
    title: 'State node',
    description:
      'A board column (or draft state). Color follows category. Select it to edit name, category, and flags in Settings.',
  },
  {
    id: 'handles',
    title: 'Connection handles',
    description:
      'Dots on each side of a state. Hover or select a state to reveal them, then drag to another state to create a transition.',
  },
  {
    id: 'forward-edge',
    title: 'Forward transition',
    description:
      'Left-to-right link uses the primary green stroke. Select it to set who can move, forms, and child checks.',
  },
  {
    id: 'reverse-edge',
    title: 'Reverse transition',
    description:
      'Right-to-left link uses a dark stroke. Cycles need both directions as separate transitions.',
  },
  {
    id: 'from-any',
    title: 'Allow transitions from any state',
    description:
      'State flag: every other state can move here without drawing each edge. Explicit edges keep their own rules.',
  },
  {
    id: 'to-any',
    title: 'Allow transitions to any state',
    description:
      'State flag: this state can move to every other state without drawing each edge. Not available on terminal states.',
  },
  {
    id: 'settings',
    title: 'Settings panel',
    description:
      'Right-hand panel for the selected state or transition. Double-click a node or edge to open it.',
  },
  {
    id: 'add-state-fab',
    title: 'Add state button',
    description:
      'Floating plus on the canvas (bottom right) adds a new state and opens Settings. Same as Ctrl/Cmd+Alt+N.',
  },
];
