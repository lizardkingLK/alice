import { classifyWorkItemSearchMatch, parseWorkItemLabels } from '@repo/types';

export type WorkItemSearchListItem = {
  readonly id: string;
  readonly title: string;
  readonly labels?: unknown;
  readonly jira_issue_key?: string | null;
};

export type CategorizedWorkItemSearchResults = {
  readonly titleMatches: WorkItemSearchListItem[];
  readonly labelMatches: Array<
    WorkItemSearchListItem & { readonly matchedLabels: string[] }
  >;
};

/** Split list rows into title vs exact label match groups (may overlap). */
export function categorizeWorkItemSearchResults(
  items: readonly WorkItemSearchListItem[],
  search: string
): CategorizedWorkItemSearchResults {
  const term = search.trim();
  if (!term) {
    return { titleMatches: [], labelMatches: [] };
  }

  const titleMatches: WorkItemSearchListItem[] = [];
  const labelMatches: CategorizedWorkItemSearchResults['labelMatches'] = [];

  for (const item of items) {
    const classification = classifyWorkItemSearchMatch(
      {
        title: item.title,
        labels: parseWorkItemLabels(item.labels),
      },
      term
    );
    if (classification.titleMatch) {
      titleMatches.push(item);
    }
    if (classification.labelMatch) {
      labelMatches.push({
        ...item,
        matchedLabels: classification.matchedLabels,
      });
    }
  }

  return { titleMatches, labelMatches };
}

/** Highlight case-insensitive substring matches in a title. */
export function highlightSearchInTitle(
  title: string,
  search: string
): Array<{ text: string; highlight: boolean }> {
  const term = search.trim();
  if (!term) {
    return [{ text: title, highlight: false }];
  }

  const lowerTitle = title.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;

  while (cursor < title.length) {
    const index = lowerTitle.indexOf(lowerTerm, cursor);
    if (index === -1) {
      parts.push({ text: title.slice(cursor), highlight: false });
      break;
    }
    if (index > cursor) {
      parts.push({ text: title.slice(cursor, index), highlight: false });
    }
    parts.push({
      text: title.slice(index, index + term.length),
      highlight: true,
    });
    cursor = index + term.length;
  }

  return parts.length > 0 ? parts : [{ text: title, highlight: false }];
}
