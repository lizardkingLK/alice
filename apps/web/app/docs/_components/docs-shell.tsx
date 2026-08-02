import type { ReactNode } from 'react';
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

export function DocsShell({ sections, entries, children }: DocsShellProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="border-border w-full min-w-0 shrink-0 lg:w-60 lg:border-r lg:pr-6">
        <div className="mb-4 min-w-0">
          <DocsSearchDialog entries={entries} />
        </div>
        <DocsNav sections={sections} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
