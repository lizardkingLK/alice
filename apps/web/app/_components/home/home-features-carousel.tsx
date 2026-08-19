'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import {
  ChartColumn,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Timer,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

const HOME_FEATURES = [
  {
    title: 'Projects',
    description:
      'Organize initiatives by project so owners, scope, and progress stay easy to find.',
    icon: FolderKanban,
  },
  {
    title: 'Backlogs',
    description:
      'Capture ideas, prioritize the queue, and pull the right work into each sprint.',
    icon: ListTodo,
  },
  {
    title: 'Boards',
    description:
      'Move work across columns, spot blockers early, and keep delivery visible day to day.',
    icon: Kanban,
  },
  {
    title: 'Sprints',
    description:
      'Plan time-boxed delivery, track commitments, and close the loop when the sprint ends.',
    icon: Timer,
  },
  {
    title: 'Dashboards',
    description:
      'Pin the metrics that matter, then arrange widgets to match how your team works.',
    icon: LayoutDashboard,
  },
  {
    title: 'Reporting',
    description:
      'See throughput, status, and trends so stakeholders stay aligned without extra spreadsheets.',
    icon: ChartColumn,
  },
] as const;

const AUTO_ADVANCE_MS = 4000;

export function HomeFeaturesCarousel() {
  const [index, setIndex] = useState(0);
  const feature = HOME_FEATURES[index]!;
  const Icon = feature.icon;
  const total = HOME_FEATURES.length;

  const goTo = (next: number) => {
    setIndex(((next % total) + total) % total);
  };

  const advance = useEffectEvent(() => {
    setIndex((current) => (current + 1) % total);
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      advance();
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent is not reactive
  }, []);

  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        What you get
      </p>

      <div
        className="relative overflow-hidden py-1"
        aria-roledescription="carousel"
        aria-label="Product features"
        aria-live="polite"
      >
        <div
          key={feature.title}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-500"
        >
          <span className="bg-primary/10 text-primary inline-flex size-9 items-center justify-center rounded-xl sm:size-11">
            <Icon className="size-4 sm:size-5" aria-hidden />
          </span>
          <h2 className="mt-3 text-lg font-semibold tracking-tight sm:mt-5 sm:text-2xl">
            {feature.title}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed text-pretty sm:text-base">
            {feature.description}
          </p>
        </div>

        <div
          className="mt-5 flex items-center gap-1.5 sm:mt-8"
          role="tablist"
          aria-label="Feature slides"
        >
          {HOME_FEATURES.map((item, i) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${item.title}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index
                  ? 'bg-primary w-6'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5'
              )}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
