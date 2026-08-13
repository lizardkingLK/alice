import {
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Timer,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { HomeSectionHeading } from '@/app/_components/home/home-section-heading';

const steps = [
  {
    step: '01',
    title: 'Create a project',
    description:
      'Stand up a workspace for a team or initiative, then bring in the people who need access.',
    detail: 'Owners, keys, and scope in one place',
    icon: FolderKanban,
  },
  {
    step: '02',
    title: 'Build the backlog',
    description:
      'Capture work items, set priorities, and shape what should ship next.',
    detail: 'Prioritize before you commit',
    icon: ListTodo,
  },
  {
    step: '03',
    title: 'Plan a sprint',
    description:
      'Pull the next slice of work into a time-boxed sprint and align on goals.',
    detail: 'Commit to what you can finish',
    icon: Timer,
  },
  {
    step: '04',
    title: 'Deliver on the board',
    description:
      'Move items across columns, update status as you go, and keep blockers visible.',
    detail: 'Day-to-day delivery in view',
    icon: Kanban,
  },
  {
    step: '05',
    title: 'Review on the dashboard',
    description:
      'Check progress, reports, and what’s next so the team stays aligned.',
    detail: 'Close the loop with visibility',
    icon: LayoutDashboard,
  },
] as const;

export function HomeHowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="home-how-heading"
      className="border-border/60 bg-muted/25 flex min-h-dvh shrink-0 snap-start flex-col justify-center overflow-y-auto border-t px-6 py-14 sm:py-16"
    >
      <div className="mx-auto w-full max-w-6xl">
        <HomeSectionHeading
          eyebrow="How it works"
          headingId="home-how-heading"
          title="From idea to done in one loop"
          description="Alice follows the way product teams already work — project, backlog, sprint, board, then review — without jumping between tools."
        />

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-5 lg:gap-4">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.step}
                className={cn(
                  'relative',
                  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500'
                )}
              >
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="bg-border absolute top-7 right-0 hidden h-px w-[calc(100%-1.25rem)] translate-x-1/2 lg:block"
                  />
                ) : null}

                <div className="relative flex h-full flex-col">
                  <div className="bg-background border-border/70 relative z-10 flex size-14 items-center justify-center rounded-2xl border shadow-sm">
                    <Icon className="text-primary size-6" aria-hidden />
                  </div>
                  <p className="text-primary mt-5 font-mono text-xs font-medium tracking-wider">
                    {item.step}
                  </p>
                  <h3 className="mt-2 text-base font-semibold tracking-tight sm:text-lg">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {item.description}
                  </p>
                  <p className="text-foreground/80 mt-3 text-xs font-medium tracking-wide">
                    {item.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
