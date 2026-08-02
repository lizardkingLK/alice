'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';
import { docHref } from '@/lib/docs/docs-shared';
import type { DocsIndexEntry } from '@/lib/docs/docs-shared';

type DocsNavProps = {
  readonly sections: ReadonlyArray<{
    readonly section: string;
    readonly entries: DocsIndexEntry[];
  }>;
};

export function DocsNav({ sections }: DocsNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
      {sections.map(({ section, entries }) => (
        <div key={section} className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {section}
          </p>
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry) => {
              const href = docHref(entry.slug);
              const isActive =
                pathname === href ||
                (href !== '/docs' && pathname.startsWith(`${href}/`));
              return (
                <li key={entry.slug}>
                  <Link
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
