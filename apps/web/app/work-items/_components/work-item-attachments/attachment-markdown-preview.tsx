'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { splitMarkdownDocumentTitle } from '@/app/work-items/_helpers/attachment-markdown';

type AttachmentMarkdownPreviewProps = {
  readonly previewUrl: string;
  readonly fileName: string;
  readonly onError: () => void;
  /** Taller scroll area when the attachment viewer is expanded. */
  readonly expanded?: boolean;
};

/** Body headings stay below the document title; bold stays medium-weight. */
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h2 className="text-foreground mt-6 mb-2 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-foreground mt-5 mb-2 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-foreground mt-4 mb-1.5 text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h4>
  ),
  strong: ({ children }) => (
    <strong className="text-foreground font-medium">{children}</strong>
  ),
};

/**
 * Fetch signed markdown text and render with GFM (Notes attach + other .md files).
 */
export function AttachmentMarkdownPreview({
  previewUrl,
  fileName,
  onError,
  expanded = false,
}: Readonly<AttachmentMarkdownPreviewProps>) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMarkdown(null);

    fetch(previewUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load markdown (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setMarkdown(text);
        }
      })
      .catch(() => {
        if (!cancelled) {
          onErrorRef.current();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Loading preview…
      </div>
    );
  }

  if (markdown === null) {
    return null;
  }

  const { documentTitle, body } = splitMarkdownDocumentTitle(markdown);
  const hasBody = body.trim().length > 0;

  return (
    <div
      className={cn(
        'w-full max-w-3xl overflow-y-auto px-5 py-4 text-left sm:px-6 sm:py-5',
        expanded ? 'max-h-[min(72dvh,44rem)]' : 'max-h-[60vh]'
      )}
      aria-label={`Markdown preview for ${fileName}`}
    >
      {documentTitle ? (
        <header
          className={cn('border-border pb-3', hasBody ? 'mb-5 border-b' : null)}
        >
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {documentTitle}
          </h1>
        </header>
      ) : null}

      {hasBody ? (
        <div
          className={cn(
            'prose prose-sm text-foreground max-w-none',
            'prose-headings:font-semibold prose-headings:tracking-tight',
            'prose-headings:text-foreground prose-p:text-foreground',
            'prose-li:text-foreground prose-strong:font-medium prose-strong:text-foreground',
            'prose-td:text-foreground prose-th:text-foreground',
            'prose-blockquote:text-foreground',
            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
            'prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none',
            'prose-pre:bg-muted prose-pre:text-foreground prose-pre:border-border prose-pre:border',
            'prose-hr:border-border'
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MARKDOWN_COMPONENTS}
          >
            {body}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
