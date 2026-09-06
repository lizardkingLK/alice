'use client';

import { cn } from '@repo/ui/lib/utils';
import { ABOUT_INTEGRATION_SPOTLIGHTS } from '@/app/about/_components/about-flow-data';
import { AboutReveal } from '@/app/about/_components/about-reveal';

export function AboutIntegrationsPanel() {
  return (
    <section
      aria-labelledby="about-integrations-heading"
      className="border-border/60 bg-muted/25 flex h-dvh shrink-0 snap-start flex-col justify-center overflow-y-auto border-t px-6 py-12 sm:py-16"
    >
      <div className="mx-auto w-full max-w-6xl">
        <AboutReveal>
          <p className="text-primary text-sm font-medium tracking-wide">
            Integrations
          </p>
          <h2
            id="about-integrations-heading"
            className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-pretty sm:text-4xl"
          >
            Connect the tools your team already uses
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
            Alice Chat, project imports, design links, and notifications plug
            into the same workspace — so context stays with the work instead of
            scattering across tabs.
          </p>
        </AboutReveal>

        <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {ABOUT_INTEGRATION_SPOTLIGHTS.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <AboutReveal delayMs={80 + index * 70}>
                  <div
                    className={cn(
                      'border-border/70 bg-background flex h-full flex-col gap-3 rounded-2xl border p-5 shadow-sm',
                      'transition-shadow duration-300 hover:shadow-md'
                    )}
                  >
                    <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">
                      {item.name}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.blurb}
                    </p>
                  </div>
                </AboutReveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
