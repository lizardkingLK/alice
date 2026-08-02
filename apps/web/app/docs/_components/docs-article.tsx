'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rewriteDocsMarkdownHref } from '@/lib/docs/docs-shared';
import { cn } from '@repo/ui/lib/utils';

type DocsArticleProps = {
  readonly title: string;
  readonly section: string;
  readonly slug: string;
  readonly markdown: string;
};

export function DocsArticle({
  title,
  section,
  slug,
  markdown,
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }) => {
              const nextHref = rewriteDocsMarkdownHref(href ?? '', slug);
              const isInternal = nextHref.startsWith('/docs');
              if (isInternal) {
                return (
                  <Link href={nextHref} {...props}>
                    {children}
                  </Link>
                );
              }
              return (
                <a
                  href={nextHref}
                  rel="noopener noreferrer"
                  target={nextHref.startsWith('http') ? '_blank' : undefined}
                  {...props}
                >
                  {children}
                </a>
              );
            },
            // Avoid duplicate H1 when markdown starts with # title
            h1: ({ children }) => (
              <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                {children}
              </h2>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = Boolean(className);
              if (isBlock) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className="bg-muted text-foreground rounded px-1 py-0.5 text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
