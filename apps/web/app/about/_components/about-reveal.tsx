'use client';

import type { ReactNode } from 'react';
import { cn } from '@repo/ui/lib/utils';
import { useInView } from '@/hooks/use-in-view';

type AboutRevealProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delayMs?: number;
};

/** Fade / slide-up when scrolled into view (respects reduced motion). */
export function AboutReveal({
  children,
  className,
  delayMs = 0,
}: Readonly<AboutRevealProps>) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0',
        className
      )}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
