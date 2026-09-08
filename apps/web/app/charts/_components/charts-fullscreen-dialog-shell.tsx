'use client';

import type { ComponentProps, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { cn } from '@repo/ui/lib/utils';

const FULLSCREEN_DIALOG_CONTENT_CLASS =
  'flex max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none';

type DialogContentProps = ComponentProps<typeof DialogContent>;

type ChartsFullscreenDialogShellProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled dialog
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  /** e.g. `h-[min(90vh,800px)] w-[min(96vw,1100px)]` */
  readonly sizeClassName: string;
  readonly headerExtra?: ReactNode;
  readonly contentProps?: Omit<
    DialogContentProps,
    'className' | 'children'
  >;
};

/** Shared full-bleed title chrome for chart widget fullscreen dialogs. */
export function ChartsFullscreenDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  sizeClassName,
  headerExtra,
  contentProps,
}: Readonly<ChartsFullscreenDialogShellProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(FULLSCREEN_DIALOG_CONTENT_CLASS, sizeClassName)}
        {...contentProps}
      >
        <div className="border-border flex shrink-0 items-center gap-2 border-b px-4 py-3 pr-12">
          <DialogTitle className="text-base font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
          {headerExtra}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
