'use client';

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
  'text-primary-foreground/80! opacity-100!',
  'hover:bg-transparent! hover:text-primary-foreground! hover:opacity-100!',
  'focus-visible:ring-0 focus-visible:outline-none',
].join(' ');

function Toaster({ ...props }: Readonly<ToasterProps>) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
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
          '--normal-bg': 'var(--primary)',
          '--normal-text': 'var(--primary-foreground)',
          '--normal-border': 'transparent',
          '--border-radius': 'var(--radius)',
          '--toast-close-button-start': 'auto',
          '--toast-close-button-end': 'auto',
          '--toast-close-button-transform': 'none',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast flex! min-h-12 w-auto min-w-[16rem] items-center border-0 py-2.5 pr-2 pl-3.5 shadow-md',
          title: 'text-sm leading-none font-medium',
          content: 'flex! w-auto! flex-none! items-center',
          icon: 'm-0! mr-2!',
          success:
            'bg-primary! text-primary-foreground! [&_[data-icon]]:text-primary-foreground',
          error: [
            'bg-destructive! text-white! [&_[data-icon]]:text-white',
            '[&_[data-close-button]]:text-white/80! [&_[data-close-button]:hover]:text-white!',
          ].join(' '),
          warning: [
            'bg-amber-500! text-white! dark:bg-amber-600! [&_[data-icon]]:text-white',
            '[&_[data-close-button]]:text-white/80! [&_[data-close-button]:hover]:text-white!',
          ].join(' '),
          info: 'bg-primary! text-primary-foreground! [&_[data-icon]]:text-primary-foreground',
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
