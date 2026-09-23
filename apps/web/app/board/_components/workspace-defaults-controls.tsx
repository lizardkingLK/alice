'use client';

import { Settings2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@repo/ui/components/ui/hover-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS } from '@/lib/preference-applied-ui';

/** Display names for the saved workspace defaults currently applied to the URL. */
export type WorkspaceDefaultsAppliedSummary = {
  readonly projectName: string;
  readonly sprintName?: string | null;
};

type WorkspaceDefaultsControlsProps = {
  readonly onOpenDefaultsDialog: () => void;
  /** True only when the URL matches the user’s saved defaults (not when filters override). */
  readonly savedDefaultsApplied: boolean;
  /** Resolved labels for the applied saved defaults; shown on hover when applied. */
  readonly appliedDefaultsSummary?: WorkspaceDefaultsAppliedSummary | null;
  readonly className?: string;
  readonly buttonClassName?: string;
};

function ActiveDefaultsSummary({
  summary,
}: Readonly<{ summary: WorkspaceDefaultsAppliedSummary }>) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Active defaults
      </p>
      <dl className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground shrink-0">Project</dt>
          <dd className="truncate font-medium">{summary.projectName}</dd>
        </div>
        {summary.sprintName ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">Sprint</dt>
            <dd className="truncate font-medium">{summary.sprintName}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function WorkspaceDefaultsControls({
  onOpenDefaultsDialog,
  savedDefaultsApplied,
  appliedDefaultsSummary = null,
  className = 'flex items-center',
  buttonClassName = 'size-9 shrink-0',
}: Readonly<WorkspaceDefaultsControlsProps>) {
  const showAppliedSummary =
    savedDefaultsApplied && appliedDefaultsSummary != null;

  const button = (
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
  );

  return (
    <div className={className}>
      {showAppliedSummary ? (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>{button}</HoverCardTrigger>
          <HoverCardContent side="bottom" align="start" className="w-56 p-3">
            <ActiveDefaultsSummary summary={appliedDefaultsSummary} />
          </HoverCardContent>
        </HoverCard>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom">
              {savedDefaultsApplied
                ? 'Your saved defaults are applied'
                : 'Defaults'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
