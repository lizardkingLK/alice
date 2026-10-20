'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import { ChevronDown, ChevronRight, Tag } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import {
  categorizeWorkItemSearchResults,
  highlightSearchInTitle,
} from '@/app/work-items/_helpers/work-item-search-results';
import {
  findForestRoots,
  indexWorkItemsById,
} from '@/app/work-items/_helpers/work-item-hierarchy-forest';
import { groupWorkItemsByParentId } from '@/app/work-items/_helpers/work-item-hierarchy-children';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

type WorkItemsSearchResultsPanelProps = {
  readonly search: string;
  /** Flat fallback when panel tree is empty (non-hierarchy views). */
  readonly items: readonly DbWorkItem[];
  /** Hits ∪ ancestors for hierarchy search tree. */
  readonly panelItems?: readonly DbWorkItem[];
  readonly matchIds?: ReadonlySet<string> | readonly string[];
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

function SearchResultsHeader({
  open,
  query,
  collapsedHint,
}: Readonly<{
  open: boolean;
  query: string;
  collapsedHint: string;
}>) {
  return (
    <CardHeader className="px-4 py-3">
      <CollapsibleTrigger
        className="bg-transparent hover:bg-transparent"
        asChild
      >
        <button
          type="button"
          className="hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors"
          aria-label={
            open ? 'Collapse search results' : 'Expand search results'
          }
        >
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">
              Search results
            </CardTitle>
            {!open ? (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {collapsedHint} for “{query}”
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
    </CardHeader>
  );
}

function ResultLink({
  itemId,
  children,
  wrap,
}: Readonly<{
  itemId: string;
  children: ReactNode;
  wrap?: boolean;
}>) {
  return (
    <Link
      href={workItemDetailHref(itemId)}
      className={cn(
        'hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        wrap && 'flex-wrap'
      )}
    >
      {children}
    </Link>
  );
}

function PanelTreeNode({
  item,
  search,
  depth,
  childrenByParent,
  matchIdSet,
}: Readonly<{
  item: DbWorkItem;
  search: string;
  depth: number;
  childrenByParent: Record<string, DbWorkItem[]>;
  matchIdSet: ReadonlySet<string>;
}>) {
  const children = childrenByParent[item.id] ?? [];
  const hasChildren = children.length > 0;
  const [open, setOpen] = useState(true);
  const isMatch = matchIdSet.has(item.id);

  return (
    <li>
      <div
        className="flex items-center gap-1 rounded-md"
        style={{ paddingLeft: depth * 12 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-md"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((previous) => !previous)}
          >
            {open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="inline-flex size-6 shrink-0" aria-hidden />
        )}
        <ResultLink itemId={item.id}>
          <WorkItemTypeBadge
            type={item.type}
            className="shrink-0 font-normal"
          />
          {item.jira_issue_key ? (
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {item.jira_issue_key}
            </span>
          ) : null}
          {isMatch ? (
            <HighlightedTitle title={item.title} search={search} />
          ) : (
            <span className="text-muted-foreground text-sm">{item.title}</span>
          )}
          {!isMatch ? (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Parent
            </Badge>
          ) : null}
        </ResultLink>
      </div>
      {hasChildren && open ? (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <PanelTreeNode
              key={child.id}
              item={child}
              search={search}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              matchIdSet={matchIdSet}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function LegacyFlatMatches({
  search,
  items,
}: Readonly<{ search: string; items: readonly DbWorkItem[] }>) {
  const { titleMatches, labelMatches } = categorizeWorkItemSearchResults(
    items,
    search
  );
  const matchCount = titleMatches.length + labelMatches.length;

  if (matchCount === 0) {
    return (
      <CardContent className="text-muted-foreground pt-0 pb-4 text-sm">
        No title or label matches for{' '}
        <span className="text-foreground font-medium">“{search}”</span>
        {'.'}
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4 pt-0">
      {titleMatches.length > 0 ? (
        <section className="space-y-2" aria-label="Title matches">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Title matches
          </h3>
          <ul className="space-y-1.5">
            {titleMatches.map((item) => (
              <li key={`title-${item.id}`}>
                <ResultLink itemId={item.id}>
                  {item.jira_issue_key ? (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {item.jira_issue_key}
                    </span>
                  ) : null}
                  <HighlightedTitle title={item.title} search={search} />
                </ResultLink>
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
                <ResultLink itemId={item.id} wrap>
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="flex flex-wrap gap-1">
                    {item.matchedLabels.map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </span>
                </ResultLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </CardContent>
  );
}

export function WorkItemsSearchResultsPanel({
  search,
  items,
  panelItems,
  matchIds,
}: Readonly<WorkItemsSearchResultsPanelProps>) {
  const trimmed = search.trim();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [trimmed]);

  const matchIdSet = useMemo(() => {
    if (!matchIds) {
      return new Set<string>();
    }
    return matchIds instanceof Set ? matchIds : new Set(matchIds);
  }, [matchIds]);

  const tree = useMemo(() => {
    if (!panelItems?.length) {
      return null;
    }
    const byId = indexWorkItemsById(panelItems);
    const childrenByParent = groupWorkItemsByParentId(panelItems);
    const roots = findForestRoots(panelItems, byId);
    return { childrenByParent, roots };
  }, [panelItems]);

  if (!trimmed) {
    return null;
  }

  const legacyCounts = categorizeWorkItemSearchResults(items, trimmed);
  const matchCount = matchIdSet.size
    ? matchIdSet.size
    : legacyCounts.titleMatches.length + legacyCounts.labelMatches.length;
  const matchesFound = `${matchCount} match${matchCount === 1 ? '' : 'es'}`;
  const collapsedHint =
    matchCount === 0 ? 'No title or label matches' : matchesFound;

  let body: ReactNode;
  if (tree) {
    body =
      tree.roots.length === 0 ? (
        <CardContent className="text-muted-foreground pt-0 pb-4 text-sm">
          No title or label matches for{' '}
          <span className="text-foreground font-medium">“{trimmed}”</span>
          {'.'}
        </CardContent>
      ) : (
        <CardContent className="pt-0 pb-4">
          <ul className="space-y-0.5" aria-label="Hierarchy search results">
            {tree.roots.map((root) => (
              <PanelTreeNode
                key={root.id}
                item={root}
                search={trimmed}
                depth={0}
                childrenByParent={tree.childrenByParent}
                matchIdSet={matchIdSet}
              />
            ))}
          </ul>
        </CardContent>
      );
  } else {
    body = <LegacyFlatMatches search={trimmed} items={items} />;
  }

  return (
    <Card className="border-border bg-card/50">
      <Collapsible open={open} onOpenChange={setOpen}>
        <SearchResultsHeader
          open={open}
          query={trimmed}
          collapsedHint={collapsedHint}
        />
        <CollapsibleContent>{body}</CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
