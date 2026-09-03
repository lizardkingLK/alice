import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getUserRole } from '@/lib/auth';
import {
  buildDocsSectionGroups,
  type DocsIndexEntry,
  withDocsAudienceDefaults,
} from '@/lib/docs/docs-shared';
import { filterDocsForViewer } from '@/lib/docs/docs-role-filter';
import { isDocsDevMode } from '@/lib/docs/docs-visibility.server';

export { docHref } from '@/lib/docs/docs-shared';

const CONTENT_ROOT = path.join(process.cwd(), 'content');
const INDEX_PATH = path.join(CONTENT_ROOT, 'docs-index.json');
const DOCS_ROOT = path.join(CONTENT_ROOT, 'docs');

function readDocsIndexRaw(): DocsIndexEntry[] {
  if (!existsSync(INDEX_PATH)) {
    return [];
  }

  const raw = readFileSync(INDEX_PATH, 'utf8');
  return withDocsAudienceDefaults(JSON.parse(raw) as DocsIndexEntry[]);
}

async function getVisibleDocsIndexForUser(): Promise<DocsIndexEntry[]> {
  return filterDocsForViewer(readDocsIndexRaw(), {
    includeDevDocs: isDocsDevMode(),
    userRole: await getUserRole(),
  });
}

export async function getDocsIndex(): Promise<DocsIndexEntry[]> {
  return getVisibleDocsIndexForUser();
}

export async function getDocsSections() {
  return buildDocsSectionGroups(
    await getVisibleDocsIndexForUser(),
    isDocsDevMode()
  );
}

export async function getDocBySlug(
  slugParts: readonly string[]
): Promise<{ entry: DocsIndexEntry; markdown: string } | null> {
  const slug = slugParts.length === 0 ? 'index' : slugParts.join('/');
  const entry = (await getVisibleDocsIndexForUser()).find(
    (item) => item.slug === slug
  );
  if (!entry) {
    return null;
  }

  const filePath = path.join(DOCS_ROOT, entry.path);
  if (!existsSync(filePath)) {
    return null;
  }

  return {
    entry,
    markdown: readFileSync(filePath, 'utf8'),
  };
}

export function getDocsShellDescription(): string {
  return isDocsDevMode()
    ? 'Product and engineering documentation for Alice.'
    : 'User guide and product help for Alice.';
}
