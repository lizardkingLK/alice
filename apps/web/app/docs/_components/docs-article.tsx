'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DocsMarkdownSlugProvider,
  docsMarkdownComponents,
} from '@/app/docs/_components/docs-markdown-components';
import { DocsPager } from '@/app/docs/_components/docs-pager';
import type { DocsIndexEntry } from '@/lib/docs/docs-shared';
import { cn } from '@repo/ui/lib/utils';

type DocsArticleProps = {
  readonly title: string;
  readonly section: string;
  readonly slug: string;
  readonly markdown: string;
  readonly previous?: DocsIndexEntry | null;
  readonly next?: DocsIndexEntry | null;
};

export function DocsArticle({
  title,
  section,
  slug,
  markdown,
  previous = null,
  next = null,
}: DocsArticleProps) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header className="border-border mb-8 flex flex-col gap-2 border-b pb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {section}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </header>
      <div
        className={cn(
          'prose text-foreground max-w-none',
          'prose-headings:scroll-mt-20 prose-headings:text-foreground',
          'prose-p:text-foreground prose-li:text-foreground',
          'prose-strong:text-foreground prose-td:text-foreground',
          'prose-th:text-foreground prose-blockquote:text-foreground',
          'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
          'prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none',
          'prose-pre:bg-muted prose-pre:text-foreground prose-pre:border-border prose-pre:border',
          'prose-hr:border-border prose-thead:border-border prose-tr:border-border'
        )}
      >
        <DocsMarkdownSlugProvider slug={slug}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={docsMarkdownComponents}
          >
            {markdown}
          </ReactMarkdown>
        </DocsMarkdownSlugProvider>
      </div>
      <DocsPager previous={previous} next={next} />
    </article>
  );
}
