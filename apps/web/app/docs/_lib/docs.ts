import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  groupDocsBySection,
  type DocsIndexEntry,
} from '@/lib/docs/docs-shared';

export { docHref } from '@/lib/docs/docs-shared';

const CONTENT_ROOT = path.join(process.cwd(), 'content');
const INDEX_PATH = path.join(CONTENT_ROOT, 'docs-index.json');
const DOCS_ROOT = path.join(CONTENT_ROOT, 'docs');

export function getDocsIndex(): DocsIndexEntry[] {
  if (!existsSync(INDEX_PATH)) {
    return [];
  }

  const raw = readFileSync(INDEX_PATH, 'utf8');
  return JSON.parse(raw) as DocsIndexEntry[];
}

export function getDocsSections() {
  return groupDocsBySection(getDocsIndex());
}

export function getDocBySlug(
  slugParts: readonly string[]
): { entry: DocsIndexEntry; markdown: string } | null {
  const slug = slugParts.length === 0 ? 'index' : slugParts.join('/');
  const entry = getDocsIndex().find((item) => item.slug === slug);
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
