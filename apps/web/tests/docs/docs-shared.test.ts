import { describe, expect, it } from 'vitest';
import {
  buildDocsIndexEntry,
  docHref,
  filterDocsByVisibility,
  filterDocsIndex,
  flattenDocsEntries,
  getAdjacentDocs,
  groupDocsBySection,
  groupDocsByUserGuideTopics,
  pathToSlug,
  rewriteDocsMarkdownHref,
  sectionFromPath,
  type DocsIndexEntry,
} from '@/lib/docs/docs-shared';
import {
  adminUserGuideEnrichment,
  memberUserGuideEnrichment,
  userGuideTestEntry,
} from '@/tests/docs/docs-test-helpers';

describe('docs-shared path helpers', () => {
  it('maps README paths to index and folder slugs', () => {
    // Arrange
    const cases = [
      { path: 'README.md', slug: 'index' },
      { path: 'guides/README.md', slug: 'guides' },
      {
        path: 'features/work-items/ATTACHMENTS.md',
        slug: 'features/work-items/ATTACHMENTS',
      },
    ] as const;

    for (const { path, slug } of cases) {
      // Act
      const result = pathToSlug(path);

      // Assert
      expect(result).toBe(slug);
    }
  });

  it('derives section labels from the top-level folder', () => {
    // Arrange / Act / Assert
    expect(sectionFromPath('README.md')).toBe('Overview');
    expect(sectionFromPath('guides/SONAR.md')).toBe('Guides');
    expect(sectionFromPath('features/board/README.md')).toBe('Features');
  });

  it('builds doc hrefs for index and nested slugs', () => {
    expect(docHref('index')).toBe('/docs');
    expect(docHref('guides/SONAR')).toBe('/docs/guides/SONAR');
  });
});

describe('rewriteDocsMarkdownHref', () => {
  it('rewrites relative markdown links into /docs slugs', () => {
    // Arrange
    const currentSlug = 'guides/DATABASE';

    // Act
    const href = rewriteDocsMarkdownHref(
      '../features/board/README.md',
      currentSlug
    );

    // Assert
    expect(href).toBe('/docs/features/board');
  });

  it('leaves external and hash links unchanged', () => {
    expect(rewriteDocsMarkdownHref('https://example.com', 'guides/SONAR')).toBe(
      'https://example.com'
    );
    expect(rewriteDocsMarkdownHref('#heading', 'guides/SONAR')).toBe(
      '#heading'
    );
  });

  it('rewrites links from folder README slugs using the slug as the directory', () => {
    expect(rewriteDocsMarkdownHref('./board/README.md', 'user-guide')).toBe(
      '/docs/user-guide/board'
    );
    expect(
      rewriteDocsMarkdownHref('./getting-started/README.md', 'user-guide')
    ).toBe('/docs/user-guide/getting-started');
  });
});

describe('buildDocsIndexEntry and filterDocsIndex', () => {
  it('extracts title, section, and searchable body text', () => {
    // Arrange
    const markdown = `# Authentication\n\nSign in with **email** or OAuth.`;

    // Act
    const entry = buildDocsIndexEntry('auth/AUTHENTICATION.md', markdown);

    // Assert
    expect(entry.slug).toBe('auth/AUTHENTICATION');
    expect(entry.title).toBe('Authentication');
    expect(entry.section).toBe('Auth');
    expect(entry.audience).toBe('dev');
    expect(entry.bodyText.toLowerCase()).toContain('email');
    expect(entry.bodyText).not.toContain('**');
  });

  it('filters the index by title and body text', () => {
    // Arrange
    const entries = [
      buildDocsIndexEntry('guides/SONAR.md', '# Sonar\n\nQuality gates.'),
      buildDocsIndexEntry('guides/SEO.md', '# SEO\n\nRobots and sitemap.'),
    ];

    // Act
    const matches = filterDocsIndex(entries, 'quality');

    // Assert
    expect(matches).toHaveLength(1);
    expect(matches[0]?.slug).toBe('guides/SONAR');
  });
});

describe('getAdjacentDocs', () => {
  const entries: DocsIndexEntry[] = [
    buildDocsIndexEntry('README.md', '# Overview\n\nIntro.'),
    buildDocsIndexEntry('guides/A.md', '# Alpha\n\nFirst guide.'),
    buildDocsIndexEntry('guides/B.md', '# Beta\n\nSecond guide.'),
  ];

  it('returns previous and next from flattened section order', () => {
    // Arrange
    const ordered = flattenDocsEntries(groupDocsBySection(entries));

    // Act
    const middle = getAdjacentDocs('guides/A', ordered);
    const first = getAdjacentDocs('index', ordered);
    const last = getAdjacentDocs('guides/B', ordered);

    // Assert
    expect(middle.previous?.slug).toBe('index');
    expect(middle.next?.slug).toBe('guides/B');
    expect(first.previous).toBeNull();
    expect(first.next?.slug).toBe('guides/A');
    expect(last.next).toBeNull();
    expect(last.previous?.slug).toBe('guides/A');
  });

  it('returns null neighbors for an unknown slug', () => {
    expect(getAdjacentDocs('missing', entries)).toEqual({
      previous: null,
      next: null,
    });
  });
});

describe('docs publish visibility', () => {
  const devEntry = buildDocsIndexEntry(
    'guides/SONAR.md',
    '# Sonar\n\nQuality.'
  );
  const userEntry = userGuideTestEntry(
    'user-guide/work-items/README.md',
    '# Work items\n\nTrack tasks.',
    memberUserGuideEnrichment('Work items', 2, 1)
  );

  it('shows only user-guide entries in production mode', () => {
    const visible = filterDocsByVisibility([devEntry, userEntry], false);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.slug).toBe('user-guide/work-items');
  });

  it('groups user-guide entries by manifest topic in production nav order', () => {
    const accessEntry = userGuideTestEntry(
      'user-guide/access/README.md',
      '# Users & access\n\nAdmission.',
      adminUserGuideEnrichment('Users & access', 5, 1)
    );

    const groups = groupDocsByUserGuideTopics([userEntry, accessEntry]);
    expect(groups.map((group) => group.section)).toEqual([
      'Work items',
      'Users & access',
    ]);
  });
});
