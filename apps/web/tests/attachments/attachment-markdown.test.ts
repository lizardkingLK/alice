import { describe, expect, it } from 'vitest';
import { splitMarkdownDocumentTitle } from '@/app/work-items/_helpers/attachment-markdown';

describe('splitMarkdownDocumentTitle', () => {
  it('pulls the leading ATX heading out as document title', () => {
    const markdown = `# 🗂️ Build Your Own Calculator

# Build Your Own Calculator

Body copy.`;

    expect(splitMarkdownDocumentTitle(markdown)).toEqual({
      documentTitle: '🗂️ Build Your Own Calculator',
      body: `# Build Your Own Calculator

Body copy.`,
    });
  });

  it('returns the full string as body when there is no leading title', () => {
    const markdown = 'Just a paragraph.\n\n## Section';

    expect(splitMarkdownDocumentTitle(markdown)).toEqual({
      documentTitle: null,
      body: markdown,
    });
  });

  it('handles a title-only document', () => {
    expect(splitMarkdownDocumentTitle('# Untitled note\n')).toEqual({
      documentTitle: 'Untitled note',
      body: '',
    });
  });
});
