'use client';

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@repo/ui/components/ui/context-menu';
import {
  WORKFLOW_DESIGNER_COMMANDS,
  type WorkflowDesignerCommandId,
} from '@/app/projects/_helpers/workflow-designer-commands';
import type { WorkflowDesignerShortcutHandlers } from '@/app/projects/_helpers/workflow-designer-shortcuts';

type WorkflowDesignerContextMenuProps = {
  readonly canEdit: boolean;
  readonly manageBusy: boolean;
  readonly hasSelection: boolean;
  readonly hasStateSelection: boolean;
  readonly hasClipboard: boolean;
  readonly handlers: WorkflowDesignerShortcutHandlers;
};

function isCommandDisabled(
  id: WorkflowDesignerCommandId,
  options: Omit<WorkflowDesignerContextMenuProps, 'handlers'>
): boolean {
  const command = WORKFLOW_DESIGNER_COMMANDS.find((item) => item.id === id);
  if (!command) {
    return true;
  }
  if (command.requiresEdit && (!options.canEdit || options.manageBusy)) {
    return true;
  }
  if (command.requiresSelection && !options.hasSelection) {
    return true;
  }
  if (command.requiresStateSelection && !options.hasStateSelection) {
    return true;
  }
  if (command.requiresClipboard && !options.hasClipboard) {
    return true;
  }
  return false;
}

export function WorkflowDesignerContextMenuContent({
  canEdit,
  manageBusy,
  hasSelection,
  hasStateSelection,
  hasClipboard,
  handlers,
}: WorkflowDesignerContextMenuProps) {
  const gate = {
    canEdit,
    manageBusy,
    hasSelection,
    hasStateSelection,
    hasClipboard,
  };

  return (
    <ContextMenuContent
      className="min-w-52"
      data-testid="workflow-designer-context-menu"
    >
      <ContextMenuLabel>Commands</ContextMenuLabel>
      {WORKFLOW_DESIGNER_COMMANDS.map((command) => (
        <div key={command.id}>
          {command.separatorBefore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem
            disabled={isCommandDisabled(command.id, gate)}
            data-testid={`workflow-designer-context-${command.id}`}
            onSelect={() => {
              handlers[command.id]();
            }}
          >
            {command.label}
            <ContextMenuShortcut>{command.keys}</ContextMenuShortcut>
          </ContextMenuItem>
        </div>
      ))}
    </ContextMenuContent>
  );
}
