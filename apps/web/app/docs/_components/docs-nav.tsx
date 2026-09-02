'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';
import { docHref } from '@/lib/docs/docs-shared';
import type { DocsSectionGroup } from '@/lib/docs/docs-shared';

type DocsNavProps = {
  readonly sections: ReadonlyArray<DocsSectionGroup>;
};

export function DocsNav({ sections }: DocsNavProps) {
  const pathname = usePathname();
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const node = activeLinkRef.current;
    if (!node) {
      return;
    }

    // Keep the active index entry in view when navigating via article links
    // or previous/next — only scrolls the docs rail viewport when needed.
    node.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [pathname]);

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
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
                    ref={isActive ? activeLinkRef : undefined}
                    href={href}
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
