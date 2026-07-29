'use client';

import { BadgeCheck, Settings2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

type WorkspaceDefaultsControlsProps = {
  readonly onOpenDefaultsDialog: () => void;
  readonly savedDefaultsApplied: boolean;
  readonly className?: string;
  readonly buttonClassName?: string;
};

export function WorkspaceDefaultsControls({
  onOpenDefaultsDialog,
  savedDefaultsApplied,
  className = 'flex items-center gap-1.5',
  buttonClassName = 'h-9',
}: Readonly<WorkspaceDefaultsControlsProps>) {
  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={buttonClassName}
        onClick={onOpenDefaultsDialog}
      >
        <Settings2 className="size-4" />
        Defaults
      </Button>

      {savedDefaultsApplied ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="text-primary inline-flex"
              aria-label="Saved workspace defaults applied"
            >
              <BadgeCheck className="size-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Your saved defaults are applied
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
