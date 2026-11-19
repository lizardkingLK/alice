'use client';

import { Button } from '@repo/ui/components/ui/button';
import { DialogClose } from '@repo/ui/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Maximize2,
  Minimize2,
  Minus,
  PictureInPicture2,
  X,
} from '@repo/ui/lib/icons';
import type {
  WorkItemFormDialogLayout,
  WorkItemFormModalLayout,
} from '@/app/work-items/_components/work-item-form/work-item-form-dialog-layout';

type WorkItemFormDialogChromeProps = {
  readonly layout: WorkItemFormDialogLayout;
  /** Last blocking layout — restored when expanding from floating. */
  readonly modalLayout: WorkItemFormModalLayout;
  /** Modern create only: float + minimize. */
  readonly allowFloatMinimize: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onLayoutChange: (layout: WorkItemFormDialogLayout) => void;
};

function expandControlCopy(isFloating: boolean, isFullscreen: boolean) {
  if (isFloating || !isFullscreen) {
    return {
      ariaLabel: 'Expand dialog' as const,
      tooltip: 'Expand' as const,
      showCollapseIcon: false,
    };
  }
  return {
    ariaLabel: 'Collapse expanded view' as const,
    tooltip: 'Collapse' as const,
    showCollapseIcon: true,
  };
}

/**
 * Jira-style create chrome: minimize / float / expand / close.
 * Hidden entirely while minimized (pill replaces the shell).
 */
export function WorkItemFormDialogChrome({
  layout,
  modalLayout,
  allowFloatMinimize,
  onLayoutChange,
}: Readonly<WorkItemFormDialogChromeProps>) {
  if (layout === 'minimized') {
    return null;
  }

  const isFullscreen = layout === 'fullscreen';
  const isFloating = layout === 'floating';
  const expandCopy = expandControlCopy(isFloating, isFullscreen);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5">
        {allowFloatMinimize ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Minimize dialog"
                className="rounded-md"
                onClick={() => onLayoutChange('minimized')}
              >
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Minimize</TooltipContent>
          </Tooltip>
        ) : null}

        {allowFloatMinimize && !isFloating ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Float dialog"
                onClick={() => onLayoutChange('floating')}
              >
                <PictureInPicture2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Float</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={expandCopy.ariaLabel}
              aria-pressed={isFullscreen && !isFloating}
              onClick={() => {
                if (isFloating) {
                  onLayoutChange(modalLayout);
                  return;
                }
                onLayoutChange(isFullscreen ? 'center' : 'fullscreen');
              }}
            >
              {expandCopy.showCollapseIcon ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{expandCopy.tooltip}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
