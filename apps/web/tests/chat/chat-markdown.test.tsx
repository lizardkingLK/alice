import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMarkdown } from '@/app/chat/_components/chat-markdown';

describe('ChatMarkdown', () => {
  it('renders bold, italic, and headers correctly', () => {
    const markdown = '# Main Heading\n\nThis is **bold** and *italic* text.';
    const { container } = render(<ChatMarkdown content={markdown} />);

    expect(
      screen.getByRole('heading', { name: 'Main Heading' })
    ).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
  });

  it('renders markdown tables with table rows and headers', () => {
    const tableMarkdown = `
| Work Item | Type | Priority |
| :--- | :--- | :--- |
| ALICE-1 | Story | High |
| ALICE-2 | Bug | Critical |
`;
    render(<ChatMarkdown content={tableMarkdown} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Work Item')).toBeInTheDocument();
    expect(screen.getByText('ALICE-1')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders code blocks properly', () => {
    const codeMarkdown = '```json\n{"key": "value"}\n```';
    const { container } = render(<ChatMarkdown content={codeMarkdown} />);

    const codeEl = container.querySelector('code');
    expect(codeEl).toBeInTheDocument();
    expect(codeEl).toHaveTextContent('{"key": "value"}');
  });

  it('renders external links with target="_blank" and rel="noopener noreferrer"', () => {
    const linkMarkdown = '[Documentation](https://example.com/docs)';
    render(<ChatMarkdown content={linkMarkdown} />);

    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
