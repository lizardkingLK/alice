import Link from 'next/link';
import {
  Files,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListTodo,
  ClipboardPenIcon,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

const features = [
  {
    title: 'Customizable dashboard',
    description:
      'Pin the metrics that matter, then drag and resize widgets to match how your team works.',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    title: 'Kanban board',
    description:
      'Move work across columns, spot blockers early, and keep delivery visible day to day.',
    icon: Kanban,
    href: '/board',
  },
  {
    title: 'Backlog planning',
    description:
      'Capture ideas, prioritize the queue, and pull the right items into each sprint.',
    icon: ListTodo,
    href: '/backlog',
  },
  {
    title: 'Projects',
    description:
      'Group related work by project so owners, scope, and progress stay easy to find.',
    icon: FolderKanban,
    href: '/projects',
  },
  {
    title: 'Work items',
    description:
      'Track issues end to end with status, assignees, due dates, and rich descriptions.',
    icon: ClipboardPenIcon,
    href: '/work-items',
  },
  {
    title: 'Files & attachments',
    description:
      'Upload specs, screenshots, and release assets where the work already lives.',
    icon: Files,
    href: '/files',
  },
] as const;

export function HomeFeatures() {
  return (
    <section
      aria-labelledby="home-features-heading"
      className="border-border/60 relative flex min-h-dvh snap-start snap-always flex-col justify-center overflow-y-auto border-t px-6 py-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%)]"
      />
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="home-features-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Everything you need to run the work
          </h2>
          <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
            Plan in the backlog, deliver on the board, and keep projects,
            issues, and files in one place.
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <Link
                  href={feature.href}
                  className={cn(
                    'border-border/70 bg-card/70 hover:border-primary/40 hover:bg-card group flex h-full flex-col rounded-xl border p-5 transition-colors',
                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                    'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500'
                  )}
                >
                  <span className="bg-primary/10 text-primary group-hover:bg-primary/15 inline-flex size-10 items-center justify-center rounded-lg transition-colors">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-medium tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
