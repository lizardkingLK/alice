'use client';

import { Settings2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS } from '@/lib/preference-applied-ui';

type WorkspaceDefaultsControlsProps = {
  readonly onOpenDefaultsDialog: () => void;
  readonly savedDefaultsApplied: boolean;
  readonly className?: string;
  readonly buttonClassName?: string;
};

export function WorkspaceDefaultsControls({
  onOpenDefaultsDialog,
  savedDefaultsApplied,
  className = 'flex items-center',
  buttonClassName = 'size-9 shrink-0',
}: Readonly<WorkspaceDefaultsControlsProps>) {
  return (
    <div className={className}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                buttonClassName,
                'cursor-pointer',
                savedDefaultsApplied && PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS
              )}
              onClick={onOpenDefaultsDialog}
              aria-label={
                savedDefaultsApplied
                  ? 'Defaults applied — open workspace defaults'
                  : 'Open workspace defaults'
              }
            >
              <Settings2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {savedDefaultsApplied
              ? 'Your saved defaults are applied'
              : 'Defaults'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
