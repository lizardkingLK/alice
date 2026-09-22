'use client';

import { cn } from '@repo/ui/lib/utils';
import type { AboutFlowPhase } from '@/app/about/_components/about-flow-data';
import { AboutReveal } from '@/app/about/_components/about-reveal';

type AboutFlowPanelProps = {
  readonly phase: AboutFlowPhase;
  readonly index: number;
};

export function AboutFlowPanel({
  phase,
  index,
}: Readonly<AboutFlowPanelProps>) {
  const Icon = phase.icon;
  const reverse = index % 2 === 1;

  return (
    <section
      aria-labelledby={`about-flow-${phase.step}`}
      className={cn(
        'border-border/60 flex h-dvh shrink-0 snap-start flex-col justify-center overflow-hidden border-t px-6 py-12 sm:py-16',
        index % 2 === 0 ? 'bg-background' : 'bg-muted/25'
      )}
    >
      <div
        className={cn(
          'relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:gap-16',
          'lg:grid-cols-2'
        )}
      >
        <AboutReveal
          className={cn(reverse ? 'lg:order-2' : 'lg:order-1')}
          delayMs={40}
        >
          <p className="text-primary font-mono text-xs font-medium tracking-wider">
            Phase {phase.step}
          </p>
          <h2
            id={`about-flow-${phase.step}`}
            className="mt-3 text-3xl font-bold tracking-tight text-pretty sm:text-4xl"
          >
            {phase.title}
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
            {phase.description}
          </p>
          <p className="text-foreground/85 mt-4 text-sm font-medium tracking-wide">
            {phase.detail}
          </p>
        </AboutReveal>

        <AboutReveal
          className={cn(
            'flex justify-center',
            reverse
              ? 'lg:order-1 lg:justify-start'
              : 'lg:order-2 lg:justify-end'
          )}
          delayMs={160}
        >
          <div
            className={cn(
              'border-border/70 bg-background relative flex size-40 items-center justify-center rounded-[2rem] border shadow-sm sm:size-52',
              'before:bg-primary/10 before:absolute before:-inset-3 before:-z-10 before:rounded-[2.5rem] before:blur-2xl'
            )}
          >
            <Icon className="text-primary size-16 sm:size-20" aria-hidden />
          </div>
        </AboutReveal>
      </div>
    </section>
  );
}
