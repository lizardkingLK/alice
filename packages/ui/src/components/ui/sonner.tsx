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
  'text-foreground/60! opacity-100!',
  'hover:bg-transparent! hover:text-foreground! hover:opacity-100!',
  'focus-visible:ring-0 focus-visible:outline-none',
].join(' ');

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
          '--normal-bg': 'color-mix(in oklch, var(--primary) 10%, var(--card))',
          '--normal-text': 'var(--foreground)',
          '--normal-border':
            'color-mix(in oklch, var(--primary) 18%, var(--border))',
          '--border-radius': 'var(--radius)',
          '--toast-close-button-start': 'auto',
          '--toast-close-button-end': 'auto',
          '--toast-close-button-transform': 'none',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast flex! min-h-12 w-auto min-w-[16rem] items-center gap-2 border py-2.5 pr-3.5 pl-3.5 shadow-md',
          title: 'text-sm leading-snug font-medium',
          content: 'flex! w-auto! flex-none! items-center',
          icon: 'm-0! mr-0!',
          success: [
            'bg-emerald-500/10! text-emerald-600! border-emerald-500/20!',
            'dark:text-emerald-400! [&_[data-icon]]:text-emerald-600! dark:[&_[data-icon]]:text-emerald-400!',
            '[&_[data-close-button]]:text-emerald-600/70! dark:[&_[data-close-button]]:text-emerald-400/70!',
            '[&_[data-close-button]:hover]:text-emerald-700! dark:[&_[data-close-button]:hover]:text-emerald-300!',
          ].join(' '),
          error: [
            'bg-destructive/10! text-destructive! border-destructive/20!',
            '[&_[data-icon]]:text-destructive!',
            '[&_[data-close-button]]:text-destructive/70!',
            '[&_[data-close-button]:hover]:text-destructive!',
          ].join(' '),
          warning: [
            'bg-amber-500/10! text-amber-700! border-amber-500/20!',
            'dark:text-amber-400! [&_[data-icon]]:text-amber-600! dark:[&_[data-icon]]:text-amber-400!',
            '[&_[data-close-button]]:text-amber-700/70! dark:[&_[data-close-button]]:text-amber-400/70!',
            '[&_[data-close-button]:hover]:text-amber-800! dark:[&_[data-close-button]:hover]:text-amber-300!',
          ].join(' '),
          info: '[&_[data-icon]]:text-primary!',
          description: 'hidden',
          closeButton: closeButtonClasses,
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
