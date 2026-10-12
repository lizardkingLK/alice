'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';

const KEYBOARD_SHORTCUTS: ReadonlyArray<{
  readonly keys: string;
  readonly description: string;
}> = [
  {
    keys: 'Esc',
    description: 'Clear the selected state or transition.',
  },
  {
    keys: 'Delete / Backspace',
    description: 'Delete the selected state or transition without confirming.',
  },
  {
    keys: 'Ctrl/Cmd + Z',
    description: 'Undo the last designer change.',
  },
  {
    keys: 'Ctrl/Cmd + X',
    description: 'Cut the selected state (transitions are not kept).',
  },
  {
    keys: 'Ctrl/Cmd + V',
    description: 'Paste a cut state as a new state (no edges).',
  },
  {
    keys: 'Ctrl/Cmd + N',
    description: 'Add a new state and open Settings.',
  },
];

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
          <ul className="space-y-3">
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <li key={shortcut.keys} className="space-y-1">
                <p className="text-foreground text-sm font-medium">
                  {shortcut.keys}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {shortcut.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
