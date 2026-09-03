import {
  applyDocsPublishEnrichment,
  buildDocsIndexEntry,
  type DocsIndexEntry,
  type DocsPublishEnrichment,
} from '@/lib/docs/docs-shared';

export function userGuideTestEntry(
  relativePath: string,
  markdown: string,
  enrichment: DocsPublishEnrichment
): DocsIndexEntry {
  return applyDocsPublishEnrichment(
    buildDocsIndexEntry(relativePath, markdown),
    enrichment
  );
}

export const memberUserGuideEnrichment = (
  section: string,
  topicOrder: number,
  pageOrder: number
): DocsPublishEnrichment => ({
  audience: 'user-guide',
  section,
  topicOrder,
  pageOrder,
  minimumRole: 'member',
});

export const adminUserGuideEnrichment = (
  section: string,
  topicOrder: number,
  pageOrder: number
): DocsPublishEnrichment => ({
  audience: 'user-guide',
  section,
  topicOrder,
  pageOrder,
  minimumRole: 'admin',
});
