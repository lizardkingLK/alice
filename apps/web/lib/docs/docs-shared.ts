/**
 * Pure helpers shared by docs:sync and the /docs app routes.
 */

export type DocsAudience = 'user-guide' | 'dev';

/** Minimum app role required to view a user-guide page (`member` < `manager` < `admin`). */
export type DocsMinimumRole = 'member' | 'manager' | 'admin';

export const DOCS_MINIMUM_ROLES: readonly DocsMinimumRole[] = [
  'member',
  'manager',
  'admin',
] as const;

export const DEFAULT_DOCS_MINIMUM_ROLE: DocsMinimumRole = 'member';

export type DocsIndexEntry = {
  readonly slug: string;
  readonly title: string;
  readonly section: string;
  readonly path: string;
  readonly excerpt: string;
  readonly bodyText: string;
  readonly audience: DocsAudience;
  /** Manifest topic order — user-guide pages in production nav. */
  readonly topicOrder?: number;
  /** Manifest page order within a topic. */
  readonly pageOrder?: number;
  /** User-guide pages only — enforced at runtime via RBAC hierarchy. */
  readonly minimumRole?: DocsMinimumRole;
};

export type DocsSectionGroup = {
  /** Stable unique key for React lists (section labels may repeat). */
  readonly id: string;
  readonly section: string;
  readonly entries: DocsIndexEntry[];
};

const SECTION_LABELS: Record<string, string> = {
  '': 'Overview',
  product: 'Product',
  architecture: 'Architecture',
  auth: 'Auth',
  database: 'Database',
  features: 'Features',
  guides: 'Guides',
  'user-guide': 'User guide',
};

/** Normalize a repo-relative docs path to posix (no leading `./`). */
export function normalizeDocsRelativePath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

/** Relative posix path under docs/ → URL slug (no leading slash, no .md). */
export function pathToSlug(relativePath: string): string {
  const normalized = normalizeDocsRelativePath(relativePath);
  const withoutExt = normalized.replace(/\.md$/i, '');
  if (withoutExt === 'README' || withoutExt.endsWith('/README')) {
    const dir = withoutExt.replace(/\/?README$/i, '');
    return dir === '' ? 'index' : dir;
  }
  return withoutExt;
}

export function sectionFromPath(relativePath: string): string {
  const normalized = normalizeDocsRelativePath(relativePath);
  const first = normalized.split('/')[0] ?? '';
  if (!first || first.endsWith('.md')) {
    return SECTION_LABELS[''] ?? 'Overview';
  }
  return SECTION_LABELS[first] ?? titleCase(first);
}

const MARKDOWN_H1_TITLE = /^#\s+([^\n]+)/m;

export function extractTitle(markdown: string, fallbackSlug: string): string {
  const heading = MARKDOWN_H1_TITLE.exec(markdown);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  const leaf = fallbackSlug.split('/').pop() ?? fallbackSlug;
  return titleCase(leaf.replaceAll('-', ' ').replaceAll('_', ' '));
}

function stripMarkdownLinksAndImages(text: string): string {
  let result = '';
  let index = 0;

  while (index < text.length) {
    const isImage = text.startsWith('![', index);
    const isLink = text[index] === '[';
    if (!isImage && !isLink) {
      result += text[index];
      index += 1;
      continue;
    }

    const labelStart = index + (isImage ? 2 : 1);
    const labelEnd = text.indexOf(']', labelStart);
    if (labelEnd === -1 || text[labelEnd + 1] !== '(') {
      result += text[index];
      index += 1;
      continue;
    }

    const urlEnd = text.indexOf(')', labelEnd + 2);
    if (urlEnd === -1) {
      result += text[index];
      index += 1;
      continue;
    }

    if (!isImage) {
      result += text.slice(labelStart, labelEnd);
    }
    result += ' ';
    index = urlEnd + 1;
  }

  return result;
}

export function stripMarkdownForSearch(markdown: string): string {
  const withoutFences = markdown.split('```').reduce((acc, chunk, index) => {
    return index % 2 === 0 ? `${acc}${chunk}` : `${acc} `;
  }, '');
  const withoutLinks = stripMarkdownLinksAndImages(withoutFences);
  return withoutLinks
    .replaceAll(/`[^`]+`/g, ' ')
    .replaceAll(/^#{1,6}\s+/gm, '')
    .replaceAll(/[*_~|>-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function excerptFromBody(bodyText: string, maxLength = 160): string {
  if (bodyText.length <= maxLength) {
    return bodyText;
  }
  return `${bodyText.slice(0, maxLength).trimEnd()}…`;
}

function directoryForSlug(currentSlug: string): string {
  if (currentSlug === 'index') {
    return '';
  }
  const separator = currentSlug.lastIndexOf('/');
  if (separator === -1) {
    // README slugs like `user-guide` map from `user-guide/README.md` — treat as a folder.
    return currentSlug;
  }
  return currentSlug.slice(0, separator);
}

/**
 * Rewrite a markdown href targeting another .md doc into an in-app /docs slug.
 * Non-markdown / external / hash-only links are returned unchanged.
 */
export function rewriteDocsMarkdownHref(
  href: string,
  currentSlug: string
): string {
  if (
    !href ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.startsWith('/docs')
  ) {
    return href;
  }

  const [pathPart, hash = ''] = href.split('#');
  if (!pathPart || !/\.md$/i.test(pathPart)) {
    return href;
  }

  const joined = resolveRelativePath(directoryForSlug(currentSlug), pathPart);
  const slug = pathToSlug(joined);
  const hashSuffix = hash ? `#${hash}` : '';
  return slug === 'index' ? `/docs${hashSuffix}` : `/docs/${slug}${hashSuffix}`;
}

export function buildDocsIndexEntry(
  relativePath: string,
  markdown: string
): DocsIndexEntry {
  const slug = pathToSlug(relativePath);
  const title = extractTitle(markdown, slug);
  const section = sectionFromPath(relativePath);
  const bodyText = stripMarkdownForSearch(markdown);
  return {
    slug,
    title,
    section,
    path: normalizeDocsRelativePath(relativePath),
    excerpt: excerptFromBody(bodyText),
    bodyText,
    audience: 'dev',
  };
}

export type DocsPublishEnrichment = {
  readonly audience: DocsAudience;
  readonly section: string;
  readonly title?: string;
  readonly topicOrder: number;
  readonly pageOrder: number;
  readonly minimumRole: DocsMinimumRole;
};

/** Apply docs-publish.json metadata to a built index entry. */
export function applyDocsPublishEnrichment(
  entry: DocsIndexEntry,
  enrichment: DocsPublishEnrichment
): DocsIndexEntry {
  return {
    ...entry,
    audience: enrichment.audience,
    section: enrichment.section,
    title: enrichment.title ?? entry.title,
    topicOrder: enrichment.topicOrder,
    pageOrder: enrichment.pageOrder,
    minimumRole: enrichment.minimumRole,
  };
}

function sortDocsEntriesByTitle(
  entries: readonly DocsIndexEntry[]
): DocsIndexEntry[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title));
}

function sortDocsEntriesByPageOrder(
  entries: readonly DocsIndexEntry[]
): DocsIndexEntry[] {
  return [...entries].sort(
    (a, b) =>
      (a.pageOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.pageOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.title.localeCompare(b.title)
  );
}

/** Production nav — group user-guide pages by manifest topic order. */
export function groupDocsByUserGuideTopics(
  entries: readonly DocsIndexEntry[]
): ReadonlyArray<DocsSectionGroup> {
  const userGuide = entries.filter((entry) => entry.audience === 'user-guide');
  const byTopic = new Map<
    string,
    { topicOrder: number; entries: DocsIndexEntry[] }
  >();

  for (const entry of userGuide) {
    const topicOrder = entry.topicOrder ?? Number.MAX_SAFE_INTEGER;
    const bucket = byTopic.get(entry.section) ?? {
      topicOrder,
      entries: [],
    };
    bucket.entries.push(entry);
    byTopic.set(entry.section, bucket);
  }

  return [...byTopic.entries()]
    .sort(
      (a, b) =>
        a[1].topicOrder - b[1].topicOrder ||
        a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
    )
    .map(([section, { entries: topicEntries }]) => ({
      id: `user-guide:${section}`,
      section,
      entries: sortDocsEntriesByPageOrder(topicEntries),
    }));
}

export function partitionDocsByAudience(entries: readonly DocsIndexEntry[]): {
  readonly userGuide: DocsIndexEntry[];
  readonly dev: DocsIndexEntry[];
} {
  const userGuide: DocsIndexEntry[] = [];
  const dev: DocsIndexEntry[] = [];

  for (const entry of entries) {
    if (entry.audience === 'user-guide') {
      userGuide.push(entry);
    } else {
      dev.push(entry);
    }
  }

  return { userGuide, dev };
}

export function buildDocsSectionGroups(
  entries: readonly DocsIndexEntry[],
  isDevMode: boolean
): ReadonlyArray<DocsSectionGroup> {
  if (!isDevMode) {
    return groupDocsByUserGuideTopics(entries);
  }

  const { userGuide, dev } = partitionDocsByAudience(entries);
  return [...groupDocsByUserGuideTopics(userGuide), ...groupDocsBySection(dev)];
}

export function filterDocsByVisibility(
  entries: readonly DocsIndexEntry[],
  includeDevDocs: boolean
): DocsIndexEntry[] {
  if (includeDevDocs) {
    return [...entries];
  }

  return entries.filter((entry) => entry.audience === 'user-guide');
}

/** Backfill audience for indexes generated before publish metadata existed. */
export function withDocsAudienceDefaults(
  entries: readonly DocsIndexEntry[]
): DocsIndexEntry[] {
  return entries.map((entry) =>
    entry.audience ? entry : { ...entry, audience: 'dev' as const }
  );
}

function resolveRelativePath(fromDir: string, relativeTarget: string): string {
  const baseParts = fromDir ? fromDir.split('/').filter(Boolean) : [];
  const targetParts = relativeTarget.replaceAll('\\', '/').split('/');

  for (const part of targetParts) {
    if (part === '.' || part === '') {
      continue;
    }
    if (part === '..') {
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }

  return baseParts.join('/');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function groupDocsBySection(
  entries: readonly DocsIndexEntry[]
): ReadonlyArray<DocsSectionGroup> {
  const order = [
    'Overview',
    'User guide',
    'Product',
    'Features',
    'Guides',
    'Auth',
    'Database',
    'Architecture',
  ];
  const bySection = new Map<string, DocsIndexEntry[]>();

  for (const entry of entries) {
    const list = bySection.get(entry.section) ?? [];
    list.push(entry);
    bySection.set(entry.section, list);
  }

  const groups: DocsSectionGroup[] = [];
  for (const section of order) {
    const entriesForSection = bySection.get(section);
    if (entriesForSection?.length) {
      groups.push({
        id: `docs:${section}`,
        section,
        entries: sortDocsEntriesByTitle(entriesForSection),
      });
      bySection.delete(section);
    }
  }

  const remaining = [...bySection.keys()].sort((a, b) => a.localeCompare(b));
  for (const section of remaining) {
    groups.push({
      id: `docs:${section}`,
      section,
      entries: sortDocsEntriesByTitle(bySection.get(section) ?? []),
    });
  }

  return groups;
}

export function filterDocsIndex(
  entries: readonly DocsIndexEntry[],
  query: string
): DocsIndexEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...entries];
  }

  return entries.filter((entry) => {
    const haystack =
      `${entry.title} ${entry.section} ${entry.excerpt} ${entry.bodyText}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function docHref(slug: string): string {
  return slug === 'index' ? '/docs' : `/docs/${slug}`;
}

/** Flatten section groups into reading order (nav / prev-next). */
export function flattenDocsEntries(
  sections: ReadonlyArray<{
    readonly entries: readonly DocsIndexEntry[];
  }>
): DocsIndexEntry[] {
  return sections.flatMap(({ entries }) => [...entries]);
}

export function getAdjacentDocs(
  slug: string,
  orderedEntries: readonly DocsIndexEntry[]
): {
  readonly previous: DocsIndexEntry | null;
  readonly next: DocsIndexEntry | null;
} {
  const index = orderedEntries.findIndex((entry) => entry.slug === slug);
  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: index > 0 ? (orderedEntries[index - 1] ?? null) : null,
    next:
      index < orderedEntries.length - 1
        ? (orderedEntries[index + 1] ?? null)
        : null,
  };
}
