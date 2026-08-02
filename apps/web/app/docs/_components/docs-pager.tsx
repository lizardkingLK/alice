import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { docHref, type DocsIndexEntry } from '@/lib/docs/docs-shared';

type DocsPagerProps = {
  readonly previous: DocsIndexEntry | null;
  readonly next: DocsIndexEntry | null;
};

type DocsPagerLinkProps = {
  readonly entry: DocsIndexEntry;
  readonly direction: 'previous' | 'next';
};

function DocsPagerLink({ entry, direction }: DocsPagerLinkProps) {
  const isNext = direction === 'next';

  return (
    <Link
      href={docHref(entry.slug)}
      className={cn(
        'border-border hover:bg-muted/50 group flex min-w-0 flex-1 flex-col gap-1 rounded-lg border p-4 transition-colors',
        isNext && 'items-end text-right'
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
        {!isNext ? (
          <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        ) : null}
        {isNext ? 'Next' : 'Previous'}
        {isNext ? (
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        ) : null}
      </span>
      <TruncatedText
        className={cn(
          'text-foreground group-hover:text-primary w-full text-sm font-medium transition-colors',
          isNext && 'text-right'
        )}
      >
        {entry.title}
      </TruncatedText>
    </Link>
  );
}

export function DocsPager({ previous, next }: DocsPagerProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      aria-label="Docs pagination"
      className="border-border mt-12 flex items-stretch gap-4 border-t pt-6 pb-8"
    >
      {previous ? (
        <DocsPagerLink entry={previous} direction="previous" />
      ) : (
        <div className="flex-1" aria-hidden />
      )}
      {next ? (
        <DocsPagerLink entry={next} direction="next" />
      ) : (
        <div className="flex-1" aria-hidden />
      )}
    </nav>
  );
}
