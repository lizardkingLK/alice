const steps = [
  {
    step: '01',
    title: 'Create a project',
    description:
      'Stand up a workspace for a team or initiative, then invite people who need access.',
  },
  {
    step: '02',
    title: 'Plan the backlog',
    description:
      'Write work items, set priorities, and slot the next slice of work into a sprint.',
  },
  {
    step: '03',
    title: 'Ship on the board',
    description:
      'Pull committed work into columns, update status as you go, and keep everyone aligned.',
  },
] as const;

export function HomeHowItWorks() {
  return (
    <section
      aria-labelledby="home-how-heading"
      className="border-border/60 bg-muted/25 flex min-h-dvh snap-start snap-always flex-col justify-center overflow-y-auto border-t px-6 py-12"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="home-how-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            How teams move work here
          </h2>
          <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
            A simple loop from idea to done — without jumping between tools.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((item, index) => (
            <li
              key={item.step}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 relative motion-safe:duration-500"
            >
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="bg-border absolute top-6 right-0 hidden h-px w-[calc(100%-1.5rem)] translate-x-1/2 md:block"
                />
              ) : null}
              <div className="relative">
                <p className="text-primary font-mono text-sm font-medium tracking-wider">
                  {item.step}
                </p>
                <h3 className="mt-3 text-lg font-medium tracking-tight">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
