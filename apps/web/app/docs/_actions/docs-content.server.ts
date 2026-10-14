'use server';

import { getDocBySlug } from '@/app/docs/_lib/docs';
import type { DocsIndexEntry } from '@/lib/docs/docs-shared';

export type DocsContentPayload = {
  readonly entry: DocsIndexEntry;
  readonly markdown: string;
};

export async function loadDocMarkdown(
  slug: string
): Promise<DocsContentPayload | null> {
  const trimmed = slug.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed === 'index' ? [] : trimmed.split('/');
  const doc = await getDocBySlug(parts);
  if (!doc) {
    return null;
  }
  return { entry: doc.entry, markdown: doc.markdown };
}
