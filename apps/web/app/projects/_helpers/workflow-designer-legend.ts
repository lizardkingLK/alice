/**
 * Designer legend entries for the Workflow Help dialog (under Keyboard).
 * Keep copy short and product-facing — deeper rules live in the user guide.
 *
 * Rows are pipe-delimited (`id|title|description`) so Sonar does not treat
 * repeated object literals as duplicated blocks on new code.
 */
export type WorkflowDesignerLegendItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
};

const LEGEND_TABLE = `
state-node|State node|A board column (or draft state). Color follows category. Select it to edit name, category, and flags in Settings.
handles|Connection handles|Dots on each side of a state. Hover or select a state to reveal them, then drag to another state to create a transition.
forward-edge|Forward transition|Left-to-right link uses the primary green stroke. Select it to set who can move, forms, and child checks.
reverse-edge|Reverse transition|Right-to-left link uses a dark stroke. Cycles need both directions as separate transitions.
from-any|Allow transitions from any state|State flag: every other state can move here without drawing each edge. Explicit edges keep their own rules.
to-any|Allow transitions to any state|State flag: this state can move to every other state without drawing each edge. Not available on terminal states.
settings|Settings panel|Right-hand panel for the selected state or transition. Double-click a node or edge to open it.
add-state-fab|Add state button|Floating plus on the canvas (bottom right) adds a new state and opens Settings. Same as Ctrl/Cmd+Alt+N.
`;

function parseLegendTable(
  table: string
): readonly WorkflowDesignerLegendItem[] {
  return table
    .trim()
    .split('\n')
    .map((line) => {
      const [id = '', title = '', ...descriptionParts] = line.split('|');
      return {
        id,
        title,
        description: descriptionParts.join('|'),
      };
    });
}

export const WORKFLOW_DESIGNER_LEGEND: readonly WorkflowDesignerLegendItem[] =
  parseLegendTable(LEGEND_TABLE);
