'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '@repo/ui/lib/utils';
import { shortcutGateContentProps } from '@repo/ui/lib/shortcut-gate';
import { Button } from '@repo/ui/components/ui/button';

function Dialog({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Root>>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Trigger>>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Portal>>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** Solid dim only — no backdrop-filter / isolate (Chromium hairline when layers promote). */
const DIALOG_OVERLAY_SURFACE =
  'pointer-events-auto fixed inset-0 z-50 bg-black/40 [backdrop-filter:none] [-webkit-backdrop-filter:none]';

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        DIALOG_OVERLAY_SURFACE,
        'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200',
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  dismissOnOutsideClick = true,
  showOverlay = true,
  overlayClassName,
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** When false, overlay / outside clicks do not close (Escape and explicit actions still do). */
  dismissOnOutsideClick?: boolean;
  /** When false, skip the dimming overlay (non-modal floating dialogs). */
  showOverlay?: boolean;
  /**
   * Extra classes for the overlay (e.g. `hidden` while floating). Prefer
   * `hidden` over `opacity-0` — opacity fights Radix fade animation and can
   * leave a washed-out “cleared” backdrop.
   */
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      {showOverlay ? (
        // Plain div (not Radix Overlay): works under modal={false}, blocks
        // clicks when visible, and can stay mounted with `hidden` while floating.
        <div
          aria-hidden="true"
          data-slot="dialog-overlay"
          className={cn(DIALOG_OVERLAY_SURFACE, overlayClassName)}
          onPointerDown={(event) => {
            if (!dismissOnOutsideClick) {
              event.preventDefault();
            }
          }}
        />
      ) : null}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 fixed top-1/2 left-1/2 z-[51] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 duration-200 outline-none sm:max-w-lg',
          className
        )}
        {...props}
        {...shortcutGateContentProps()}
        onPointerDownOutside={(event) => {
          if (!dismissOnOutsideClick) {
            event.preventDefault();
          }
          onPointerDownOutside?.(event);
        }}
        onInteractOutside={(event) => {
          if (!dismissOnOutsideClick) {
            event.preventDefault();
          }
          onInteractOutside?.(event);
        }}
        onFocusOutside={(event) => {
          if (!dismissOnOutsideClick) {
            event.preventDefault();
          }
          onFocusOutside?.(event);
        }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <X />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'bg-muted/50 -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base leading-none font-medium', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
