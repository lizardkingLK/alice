'use client';

import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';
import { ExternalLink } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@repo/ui/lib/utils';

interface OGMetadata {
  title: string;
  description: string;
  image?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  readonly url: string;
  readonly children: ReactNode;
}

function isPreviewableUrl(url: string): boolean {
  if (!url || url === '#' || url.startsWith('#')) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getSafeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function LinkPreviewDescription({
  description,
}: Readonly<{ description: string }>) {
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [isClamped, setIsClamped] = React.useState(false);

  React.useLayoutEffect(() => {
    setExpanded(false);
  }, [description]);

  React.useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) {
      return;
    }

    const updateClampState = () => {
      setIsClamped(element.scrollHeight > element.clientHeight + 1);
    };

    updateClampState();

    const observer = new ResizeObserver(updateClampState);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [description, expanded]);

  return (
    <div className="space-y-1">
      <p
        ref={textRef}
        className={cn(
          'text-muted-foreground text-[11px] leading-relaxed',
          !expanded && 'line-clamp-2'
        )}
      >
        {description}
      </p>
      {isClamped || expanded ? (
        <button
          type="button"
          className="text-primary hover:text-primary/80 text-[11px] font-medium hover:underline"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </div>
  );
}

export function LinkPreview({ url, children }: Readonly<LinkPreviewProps>) {
  const [metadata, setMetadata] = React.useState<OGMetadata | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hasFetched, setHasFetched] = React.useState(false);

  const canPreview = isPreviewableUrl(url);

  const fetchMetadata = () => {
    if (!canPreview || hasFetched) {
      return;
    }

    setLoading(true);

    fetch(`/api/meta?url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as OGMetadata;
        setMetadata({
          title: data.title,
          description: data.description,
          image: data.image,
          siteName: data.siteName,
        });
      })
      .catch((err: unknown) => {
        console.error('error. failed to parse link metadata:', err);
      })
      .finally(() => {
        setLoading(false);
        setHasFetched(true);
      });
  };

  // Placeholder / relative fragments like "#" are not absolute URLs — skip preview.
  if (!canPreview) {
    return <>{children}</>;
  }

  const hostname = metadata?.siteName || getSafeHostname(url) || url;
  const description =
    metadata?.description || 'No preview information available for this URL.';

  return (
    <HoverCard openDelay={400} closeDelay={200}>
      <HoverCardTrigger asChild onMouseEnter={fetchMetadata}>
        <span className="inline cursor-pointer">{children}</span>
      </HoverCardTrigger>

      <HoverCardContent className="w-80 p-3 shadow-md" side="top" align="start">
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="bg-muted h-32 w-full animate-pulse rounded" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-3 w-full animate-pulse rounded" />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {metadata?.image ? (
              <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-md border">
                <img
                  src={metadata.image}
                  alt={metadata.title || 'Preview'}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <h4 className="text-foreground line-clamp-1 text-xs font-semibold">
                {metadata?.title || url}
              </h4>
              <LinkPreviewDescription description={description} />
            </div>

            <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-[10px]">
              <span className="max-w-45 truncate font-mono">{hostname}</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1 font-medium hover:underline"
              >
                Open link <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
