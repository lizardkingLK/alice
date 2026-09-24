'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';

const closeButtonClasses = [
  'order-3! static! inset-auto! top-auto! right-auto! left-auto! transform-none!',
  'ml-auto! size-8 shrink-0 rounded-md! border-0! bg-transparent! shadow-none!',
  'text-foreground/50! opacity-100!',
  'hover:bg-transparent! hover:text-foreground! hover:opacity-100!',
  'focus-visible:ring-0 focus-visible:outline-none',
].join(' ');

/**
 * Sonner toaster styled like shadcn Toast:
 * title + muted description, card surface, close on the right.
 * @see https://ui.shadcn.com/docs/components/base/toast
 */
function Toaster({ ...props }: Readonly<ToasterProps>) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-right"
      expand
      closeButton
      duration={5000}
      icons={{
        success: <CircleCheckIcon className="size-4 shrink-0" />,
        info: <InfoIcon className="size-4 shrink-0" />,
        warning: <TriangleAlertIcon className="size-4 shrink-0" />,
        error: <OctagonXIcon className="size-4 shrink-0" />,
        loading: <Loader2Icon className="size-4 shrink-0 animate-spin" />,
        close: <XIcon className="size-4" />,
      }}
      style={
        {
          '--normal-bg': 'var(--card)',
          '--normal-text': 'var(--foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--card)',
          '--error-bg': 'var(--card)',
          '--warning-bg': 'var(--card)',
          '--border-radius': 'var(--radius)',
          '--toast-close-button-start': 'auto',
          '--toast-close-button-end': 'auto',
          '--toast-close-button-transform': 'none',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast flex! w-auto min-w-[18rem] max-w-[26rem] items-start gap-3 rounded-xl! border bg-card py-3.5 pr-3.5 pl-4 shadow-lg',
          title: 'text-foreground text-sm leading-snug font-semibold',
          description: 'text-muted-foreground text-sm leading-snug opacity-100!',
          content: 'flex! min-w-0 flex-1 flex-col gap-0.5',
          icon: 'm-0! mt-0.5! mr-0!',
          success:
            'bg-card! text-foreground! [&_[data-icon]]:text-emerald-600! dark:[&_[data-icon]]:text-emerald-400!',
          error: [
            'bg-card! text-foreground! border-destructive/25!',
            '[&_[data-icon]]:text-destructive!',
            '[&_[data-close-button]]:text-destructive/70!',
            '[&_[data-close-button]:hover]:text-destructive!',
          ].join(' '),
          warning:
            'bg-card! text-foreground! [&_[data-icon]]:text-amber-600! dark:[&_[data-icon]]:text-amber-400!',
          info: 'bg-card! text-foreground! [&_[data-icon]]:text-primary!',
          closeButton: closeButtonClasses,
          actionButton:
            'bg-background border-border text-foreground hover:bg-muted h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium shadow-none',
          cancelButton:
            'bg-transparent text-muted-foreground hover:text-foreground h-8 shrink-0 px-2 text-xs',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
