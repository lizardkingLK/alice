'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { WORKFLOW_DESIGNER_COMMANDS } from '@/app/projects/_helpers/workflow-designer-commands';

type WorkflowDesignerHelpProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
  readonly onOpenChange: (open: boolean) => void;
};

export function WorkflowDesignerHelp({
  open,
  onOpenChange,
}: WorkflowDesignerHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(80dvh,32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        data-testid="workflow-designer-help"
      >
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <DialogTitle>Workflow Help</DialogTitle>
          <DialogDescription className="sr-only">
            Keyboard shortcuts for the workflow designer.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <h3 className="text-foreground mb-3 text-sm font-semibold">
            Keyboard
          </h3>
          <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
            Right-click the canvas for the same commands with shortcuts.
          </p>
          <ul className="space-y-3">
            {WORKFLOW_DESIGNER_COMMANDS.map((command) => (
              <li key={command.id} className="space-y-1">
                <p className="text-foreground text-sm font-medium">
                  {command.keys}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {command.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
