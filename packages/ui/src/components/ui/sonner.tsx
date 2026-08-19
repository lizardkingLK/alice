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
          '--normal-bg': 'color-mix(in oklch, var(--card) 78%, transparent)',
          '--normal-text': 'var(--foreground)',
          '--normal-border':
            'color-mix(in oklch, var(--primary) 18%, var(--border))',
          '--success-bg':
            'color-mix(in oklch, var(--card) 68%, oklch(0.78 0.12 155))',
          '--error-bg':
            'color-mix(in oklch, var(--card) 72%, var(--destructive))',
          '--warning-bg':
            'color-mix(in oklch, var(--card) 70%, oklch(0.84 0.14 85))',
          '--border-radius': 'var(--radius)',
          '--toast-close-button-start': 'auto',
          '--toast-close-button-end': 'auto',
          '--toast-close-button-transform': 'none',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast flex! min-h-12 w-auto min-w-[16rem] items-center gap-2 border py-2.5 pr-3.5 pl-3.5 shadow-lg backdrop-blur-xl backdrop-saturate-150',
          title: 'text-sm leading-snug font-medium',
          content: 'flex! w-auto! flex-none! items-center',
          icon: 'm-0! mr-0!',
          success: [
            'text-emerald-700! border-emerald-500/35!',
            'dark:text-emerald-300! [&_[data-icon]]:text-emerald-600! dark:[&_[data-icon]]:text-emerald-400!',
            '[&_[data-close-button]]:text-emerald-700/70! dark:[&_[data-close-button]]:text-emerald-300/70!',
            '[&_[data-close-button]:hover]:text-emerald-800! dark:[&_[data-close-button]:hover]:text-emerald-200!',
          ].join(' '),
          error: [
            'text-destructive! border-destructive/30!',
            '[&_[data-icon]]:text-destructive!',
            '[&_[data-close-button]]:text-destructive/70!',
            '[&_[data-close-button]:hover]:text-destructive!',
          ].join(' '),
          warning: [
            'text-amber-800! border-amber-500/35!',
            'dark:text-amber-300! [&_[data-icon]]:text-amber-600! dark:[&_[data-icon]]:text-amber-400!',
            '[&_[data-close-button]]:text-amber-800/70! dark:[&_[data-close-button]:hover]:text-amber-300/70!',
            '[&_[data-close-button]:hover]:text-amber-900! dark:[&_[data-close-button]:hover]:text-amber-200!',
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
