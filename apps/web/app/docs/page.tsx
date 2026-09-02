import { Metadata } from 'next';
import Link from 'next/link';
import {
  DocsPageFrame,
  DOCS_ROBOTS,
} from '@/app/docs/_components/docs-page-frame';
import {
  docHref,
  getDocsSections,
  getDocsShellDescription,
} from '@/app/docs/_lib/docs';
import { isDocsDevMode } from '@/lib/docs/docs-visibility.server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Docs',
  robots: DOCS_ROBOTS,
};

export default async function DocsPage() {
  const sections = await getDocsSections();
  const isDevDocs = isDocsDevMode();

  return (
    <DocsPageFrame>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {isDevDocs ? 'Documentation' : 'User guide'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isDevDocs
              ? 'Browse guides and feature docs, or press '
              : 'Browse product help topics, or press '}
            <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl+K
            </kbd>{' '}
            to search.
          </p>
          {!isDevDocs ? (
            <p className="text-muted-foreground text-xs">
              {getDocsShellDescription()}
            </p>
          ) : null}
        </header>

        {sections.map(({ id, section, entries: sectionEntries }) => (
          <section key={id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{section}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {sectionEntries.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={docHref(entry.slug)}
                    className="border-border hover:bg-muted/50 block rounded-lg border p-3 transition-colors"
                  >
                    <p className="font-medium">{entry.title}</p>
                    {entry.excerpt ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {entry.excerpt}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DocsPageFrame>
  );
}
