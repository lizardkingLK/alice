/**
 * Pure helpers shared by docs:sync and the /docs app routes.
 */

export type DocsIndexEntry = {
  readonly slug: string;
  readonly title: string;
  readonly section: string;
  readonly path: string;
  readonly excerpt: string;
  readonly bodyText: string;
};

const SECTION_LABELS: Record<string, string> = {
  '': 'Overview',
  product: 'Product',
  architecture: 'Architecture',
  auth: 'Auth',
  database: 'Database',
  features: 'Features',
  guides: 'Guides',
};

/** Relative posix path under docs/ → URL slug (no leading slash, no .md). */
export function pathToSlug(relativePath: string): string {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
  const withoutExt = normalized.replace(/\.md$/i, '');
  if (withoutExt === 'README' || withoutExt.endsWith('/README')) {
    const dir = withoutExt.replace(/\/?README$/i, '');
    return dir === '' ? 'index' : dir;
  }
  return withoutExt;
}

export function sectionFromPath(relativePath: string): string {
  const normalized = relativePath.replaceAll('\\', '/');
  const first = normalized.split('/')[0] ?? '';
  if (!first || first.endsWith('.md')) {
    return SECTION_LABELS[''] ?? 'Overview';
  }
  return SECTION_LABELS[first] ?? titleCase(first);
}

export function extractTitle(markdown: string, fallbackSlug: string): string {
  const heading = markdown.match(/^#\s+([^\n]+)/m);
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
    return '';
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
    path: relativePath.replaceAll('\\', '/'),
    excerpt: excerptFromBody(bodyText),
    bodyText,
  };
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
): ReadonlyArray<{
  readonly section: string;
  readonly entries: DocsIndexEntry[];
}> {
  const order = [
    'Overview',
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

  for (const list of bySection.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  const groups: { section: string; entries: DocsIndexEntry[] }[] = [];
  for (const section of order) {
    const entriesForSection = bySection.get(section);
    if (entriesForSection?.length) {
      groups.push({ section, entries: entriesForSection });
      bySection.delete(section);
    }
  }

  const remaining = [...bySection.keys()].sort((a, b) => a.localeCompare(b));
  for (const section of remaining) {
    groups.push({ section, entries: bySection.get(section) ?? [] });
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
