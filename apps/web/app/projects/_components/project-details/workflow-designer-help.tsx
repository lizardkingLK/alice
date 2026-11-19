'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { WORKFLOW_DESIGNER_COMMANDS } from '@/app/projects/_helpers/workflow-designer-commands';
import { WORKFLOW_DESIGNER_LEGEND } from '@/app/projects/_helpers/workflow-designer-legend';

type WorkflowDesignerHelpProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback parameter name documents the payload
  readonly onOpenChange: (open: boolean) => void;
};

type HelpSectionItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
};

function HelpSection({
  heading,
  intro,
  items,
  className,
  listTestId,
}: {
  readonly heading: string;
  readonly intro: string;
  readonly items: readonly HelpSectionItem[];
  readonly className?: string;
  readonly listTestId?: string;
}) {
  return (
    <section className={className}>
      <h3 className="text-foreground mb-3 text-sm font-semibold">{heading}</h3>
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
        {intro}
      </p>
      <ul className="space-y-3" data-testid={listTestId}>
        {items.map((item) => (
          <li key={item.id} className="space-y-1">
            <p className="text-foreground text-sm font-medium">{item.title}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const KEYBOARD_HELP_ITEMS: readonly HelpSectionItem[] =
  WORKFLOW_DESIGNER_COMMANDS.map((command) => ({
    id: command.id,
    title: command.keys,
    description: command.description,
  }));

export function WorkflowDesignerHelp({
  open,
  onOpenChange,
}: WorkflowDesignerHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(80dvh,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        data-testid="workflow-designer-help"
      >
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <DialogTitle>Workflow Help</DialogTitle>
          <DialogDescription className="sr-only">
            Keyboard shortcuts and designer legend for the workflow designer.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <HelpSection
            heading="Keyboard"
            intro="Right-click the canvas for the same commands with shortcuts."
            items={KEYBOARD_HELP_ITEMS}
          />
          <HelpSection
            className="mt-6"
            heading="Designer legend"
            intro="What you see on the canvas and in Settings."
            listTestId="workflow-designer-legend"
            items={WORKFLOW_DESIGNER_LEGEND}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
