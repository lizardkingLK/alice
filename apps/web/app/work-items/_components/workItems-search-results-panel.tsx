'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Tag } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import {
  categorizeWorkItemSearchResults,
  highlightSearchInTitle,
  type WorkItemSearchListItem,
} from '@/app/work-items/_helpers/work-item-search-results';

type WorkItemsSearchResultsPanelProps = {
  readonly search: string;
  readonly items: readonly WorkItemSearchListItem[];
};

function HighlightedTitle({
  title,
  search,
}: Readonly<{ title: string; search: string }>) {
  return (
    <span className="text-sm font-medium">
      {highlightSearchInTitle(title, search).map((part, index) =>
        part.highlight ? (
          <mark
            key={`h-${index}-${part.text}`}
            className="bg-primary/20 text-foreground rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`t-${index}-${part.text}`}>{part.text}</span>
        )
      )}
    </span>
  );
}

function SearchResultLink({
  item,
  wrap,
  children,
}: Readonly<{
  item: WorkItemSearchListItem;
  wrap?: boolean;
  children: ReactNode;
}>) {
  return (
    <Link
      href={workItemDetailHref(item.id)}
      className={cn(
        'hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        wrap && 'flex-wrap'
      )}
    >
      {item.jira_issue_key ? (
        <span className="text-muted-foreground shrink-0 font-mono text-xs">
          {item.jira_issue_key}
        </span>
      ) : null}
      {children}
    </Link>
  );
}

export function WorkItemsSearchResultsPanel({
  search,
  items,
}: Readonly<WorkItemsSearchResultsPanelProps>) {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const { titleMatches, labelMatches } = categorizeWorkItemSearchResults(
    items,
    trimmed
  );

  if (titleMatches.length === 0 && labelMatches.length === 0) {
    return (
      <Card className="border-border bg-card/50">
        <CardContent className="text-muted-foreground py-4 text-sm">
          No title or label matches for{' '}
          <span className="text-foreground font-medium">“{trimmed}”</span>
          {'.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Search results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {titleMatches.length > 0 ? (
          <section className="space-y-2" aria-label="Title matches">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Title matches
            </h3>
            <ul className="space-y-1.5">
              {titleMatches.map((item) => (
                <li key={`title-${item.id}`}>
                  <SearchResultLink item={item}>
                    <HighlightedTitle title={item.title} search={trimmed} />
                  </SearchResultLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {labelMatches.length > 0 ? (
          <section className="space-y-2" aria-label="Label matches">
            <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <Tag className="size-3.5" />
              Label matches
            </h3>
            <ul className="space-y-1.5">
              {labelMatches.map((item) => (
                <li key={`label-${item.id}`}>
                  <SearchResultLink item={item} wrap>
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="flex flex-wrap gap-1">
                      {item.matchedLabels.map((label) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </span>
                  </SearchResultLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
