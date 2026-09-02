import { describe, expect, it } from 'vitest';
import {
  flattenDocsPublishManifest,
  normalizePublishPath,
  parseDocsPublishManifest,
  type DocsPublishManifest,
} from '@/lib/docs/docs-publish';

const sampleManifest: DocsPublishManifest = {
  version: 1,
  topics: [
    {
      id: 'work-items',
      title: 'Work items',
      order: 2,
      pages: [
        {
          path: 'user-guide/work-items/README.md',
          order: 1,
        },
      ],
    },
    {
      id: 'access',
      title: 'Users & access',
      order: 5,
      pages: [
        {
          path: 'user-guide/access/allowlist.md',
          title: 'Allowlist',
          order: 2,
        },
      ],
    },
  ],
};

describe('docs-publish manifest', () => {
  it('normalizes manifest page paths', () => {
    expect(normalizePublishPath('.\\user-guide\\access\\README.md')).toBe(
      'user-guide/access/README.md'
    );
  });

  it('parses a valid manifest', () => {
    const manifest = parseDocsPublishManifest(sampleManifest);
    expect(manifest.topics).toHaveLength(2);
    expect(manifest.topics[1]?.pages[0]?.title).toBe('Allowlist');
  });

  it('rejects manifests with no topics', () => {
    expect(() =>
      parseDocsPublishManifest({
        version: 1,
        topics: [],
      })
    ).toThrow(/at least one topic/i);
  });

  it('flattens topics into a path lookup map', () => {
    const byPath = flattenDocsPublishManifest(sampleManifest);
    expect(byPath.get('user-guide/work-items/README.md')?.topicTitle).toBe(
      'Work items'
    );
    expect(byPath.get('user-guide/access/allowlist.md')?.title).toBe(
      'Allowlist'
    );
  });
});
