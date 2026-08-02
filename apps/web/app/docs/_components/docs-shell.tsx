'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { useSidebar } from '@repo/ui/components/ui/sidebar';
import { cn } from '@repo/ui/lib/utils';
import { DocsNav } from '@/app/docs/_components/docs-nav';
import { DocsSearchDialog } from '@/app/docs/_components/docs-search-dialog';
import type { DocsIndexEntry } from '@/lib/docs/docs-shared';

type DocsShellProps = {
  readonly sections: ReadonlyArray<{
    readonly section: string;
    readonly entries: DocsIndexEntry[];
  }>;
  readonly entries: readonly DocsIndexEntry[];
  readonly children: ReactNode;
};

/** Width of the docs index rail (matches Tailwind `w-64`). */
const DOCS_INDEX_WIDTH_REM = 16;
/** Gap between index and article. */
const DOCS_INDEX_GAP_REM = 2;

export function DocsShell({ sections, entries, children }: DocsShellProps) {
  const { state, isMobile } = useSidebar();
  const dashboardRailRem = state === 'collapsed' ? 3 : 16;
  // Content padding from DashboardShell (`p-4` / `sm:p-6`) ≈ 1.5rem on desktop.
  const contentPadRem = 1.5;
  const fixedLeftRem = dashboardRailRem + contentPadRem;
  const articlePadRem = DOCS_INDEX_WIDTH_REM + DOCS_INDEX_GAP_REM;

  return (
    <div className="relative">
      <aside
        className={cn(
          'border-border bg-background flex w-full min-w-0 flex-col gap-4',
          isMobile
            ? 'mb-6 h-72 p-4'
            : 'fixed top-16 bottom-0 z-20 w-64 border-r p-4'
        )}
        style={
          isMobile
            ? undefined
            : {
                left: `${fixedLeftRem}rem`,
              }
        }
      >
        <div className="min-w-0 shrink-0">
          <DocsSearchDialog entries={entries} />
        </div>
        <ScrollArea className="h-0 min-h-0 flex-1 pr-2">
          <DocsNav sections={sections} />
        </ScrollArea>
      </aside>

      <div
        className="min-w-0"
        style={
          isMobile
            ? undefined
            : {
                paddingLeft: `${articlePadRem}rem`,
              }
        }
      >
        {children}
      </div>
    </div>
  );
}
