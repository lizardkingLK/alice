import { describe, expect, it } from 'vitest';
import {
  buildDocsIndexEntry,
  docHref,
  filterDocsIndex,
  pathToSlug,
  rewriteDocsMarkdownHref,
  sectionFromPath,
} from '@/lib/docs/docs-shared';

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
