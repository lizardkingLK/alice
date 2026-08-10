'use client';

import { Settings2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
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
  className = 'flex items-center gap-1.5',
  buttonClassName = 'h-9',
}: Readonly<WorkspaceDefaultsControlsProps>) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        buttonClassName,
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
      Defaults
    </Button>
  );

  if (!savedDefaultsApplied) {
    return <div className={className}>{button}</div>;
  }

  return (
    <div className={className}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom">
          Your saved defaults are applied
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
