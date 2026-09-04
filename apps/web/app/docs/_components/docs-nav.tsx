'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';
import { docHref } from '@/lib/docs/docs-shared';
import type { DocsSectionGroup } from '@/lib/docs/docs-shared';

type DocsNavProps = {
  readonly sections: ReadonlyArray<DocsSectionGroup>;
  readonly scrollViewportRef: RefObject<HTMLDivElement | null>;
};

function scrollActiveLinkIntoViewport(
  viewport: HTMLElement,
  activeLink: HTMLElement
): void {
  const linkTop = activeLink.offsetTop;
  const linkBottom = linkTop + activeLink.offsetHeight;
  const viewTop = viewport.scrollTop;
  const viewBottom = viewTop + viewport.clientHeight;

  if (linkTop < viewTop) {
    viewport.scrollTop = linkTop;
    return;
  }

  if (linkBottom > viewBottom) {
    viewport.scrollTop = linkBottom - viewport.clientHeight;
  }
}

export function DocsNav({ sections, scrollViewportRef }: DocsNavProps) {
  const pathname = usePathname();
  const navRootRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    const navRoot = navRootRef.current;
    if (!viewport || !navRoot) {
      return;
    }

    const activeLink = navRoot.querySelector<HTMLElement>(
      '[data-docs-nav-active="true"]'
    );
    if (!activeLink) {
      return;
    }

    scrollActiveLinkIntoViewport(viewport, activeLink);
  }, [pathname, scrollViewportRef, sections]);

  return (
    <nav
      ref={navRootRef}
      aria-label="Documentation"
      className="flex flex-col gap-6"
    >
      {sections.map(({ id, section, entries }) => (
        <div key={id} className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {section}
          </p>
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry) => {
              const href = docHref(entry.slug);
              // Exact match only — prefix match wrongly highlights parent README
              // slugs (e.g. /docs/features/access) when viewing a child page.
              const isActive = pathname === href;
              return (
                <li key={entry.slug}>
                  <Link
                    href={href}
                    data-docs-nav-active={isActive ? 'true' : undefined}
                    className={cn(
                      'hover:bg-muted block rounded-md px-2 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {entry.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
