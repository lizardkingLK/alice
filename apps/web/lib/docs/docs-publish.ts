/**
 * Types and helpers for docs/docs-publish.json — production user-guide curation.
 */

import { normalizeDocsRelativePath, type DocsMinimumRole } from './docs-shared';

export type { DocsAudience, DocsMinimumRole } from './docs-shared';

export type DocsPublishPage = {
  readonly path: string;
  readonly title?: string;
  readonly order: number;
  readonly minimumRole?: DocsMinimumRole;
};

export type DocsPublishTopic = {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly pages: readonly DocsPublishPage[];
};

export type DocsPublishManifest = {
  readonly version: 1;
  readonly topics: readonly DocsPublishTopic[];
};

export type DocsPublishPageRef = DocsPublishPage & {
  readonly topicId: string;
  readonly topicTitle: string;
  readonly topicOrder: number;
};

/** Flatten manifest topics into path → publish metadata (first path wins). */
export function flattenDocsPublishManifest(
  manifest: DocsPublishManifest
): Map<string, DocsPublishPageRef> {
  const byPath = new Map<string, DocsPublishPageRef>();

  for (const topic of manifest.topics) {
    for (const page of topic.pages) {
      const normalized = normalizePublishPath(page.path);
      if (byPath.has(normalized)) {
        continue;
      }

      byPath.set(normalized, {
        ...page,
        path: normalized,
        topicId: topic.id,
        topicTitle: topic.title,
        topicOrder: topic.order,
      });
    }
  }

  return byPath;
}

export function normalizePublishPath(relativePath: string): string {
  return normalizeDocsRelativePath(relativePath);
}

export function parseDocsPublishManifest(raw: unknown): DocsPublishManifest {
  const record = readManifestRecord(raw);
  assertManifestVersion(record.version);

  if (!Array.isArray(record.topics) || record.topics.length === 0) {
    throw new Error('docs-publish.json must include at least one topic');
  }

  return {
    version: 1,
    topics: record.topics.map((topicRaw) => parseDocsPublishTopic(topicRaw)),
  };
}

function readManifestRecord(raw: unknown): Record<string, unknown> {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('docs-publish.json must be a JSON object');
  }

  return raw as Record<string, unknown>;
}

function assertManifestVersion(version: unknown): void {
  if (version !== 1) {
    throw new Error('docs-publish.json version must be 1');
  }
}

function parseDocsPublishTopic(topicRaw: unknown): DocsPublishTopic {
  if (topicRaw == null || typeof topicRaw !== 'object') {
    throw new Error('docs-publish.json topic must be an object');
  }

  const topic = topicRaw as Record<string, unknown>;
  const id = readNonEmptyString(topic.id, 'topic id');
  const title = readNonEmptyString(topic.title, 'topic title');
  const order = readOrder(topic.order, 'topic order');

  if (!Array.isArray(topic.pages) || topic.pages.length === 0) {
    throw new Error(`docs-publish.json topic "${id}" must include pages`);
  }

  return {
    id,
    title,
    order,
    pages: topic.pages.map((pageRaw) => parseDocsPublishPage(id, pageRaw)),
  };
}

function parseDocsPublishPage(
  topicId: string,
  pageRaw: unknown
): DocsPublishPage {
  if (pageRaw == null || typeof pageRaw !== 'object') {
    throw new Error(
      `docs-publish.json topic "${topicId}" page must be an object`
    );
  }

  const page = pageRaw as Record<string, unknown>;
  const path = normalizePublishPath(
    readNonEmptyString(page.path, `topic "${topicId}" page path`)
  );
  if (!path.toLowerCase().endsWith('.md')) {
    throw new Error(
      `docs-publish.json topic "${topicId}" page path must end with .md: ${path}`
    );
  }

  return {
    path,
    title: readOptionalTitle(page.title),
    order: readOrder(page.order, `topic "${topicId}" page order`),
    minimumRole: readMinimumRole(page.minimumRole, topicId),
  };
}

function readMinimumRole(
  value: unknown,
  topicId: string
): DocsMinimumRole | undefined {
  if (value == null) {
    return undefined;
  }

  if (value === 'member' || value === 'manager' || value === 'admin') {
    return value;
  }

  throw new Error(
    `docs-publish.json topic "${topicId}" minimumRole must be member, manager, or admin`
  );
}

function readOptionalTitle(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`docs-publish.json ${label} must be a non-empty string`);
  }
  return value.trim();
}

function readOrder(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `docs-publish.json ${label} must be a non-negative integer`
    );
  }
  return value;
}
