import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DocsSearchDialog } from '@/app/docs/_components/docs-search-dialog';
import type { DocsIndexEntry } from '@/lib/docs/docs-shared';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const ENTRIES: DocsIndexEntry[] = [
  {
    slug: 'guides/SONAR',
    title: 'Sonar',
    section: 'Guides',
    path: 'guides/SONAR.md',
    excerpt: 'Quality gates and duplication.',
    bodyText: 'Quality gates and duplication.',
  },
  {
    slug: 'features/board',
    title: 'Board',
    section: 'Features',
    path: 'features/board/README.md',
    excerpt: 'Kanban board defaults.',
    bodyText: 'Kanban board defaults.',
  },
];

describe('DocsSearchDialog', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('filters results and navigates on select', async () => {
    // Arrange
    render(<DocsSearchDialog entries={ENTRIES} />);
    fireEvent.click(screen.getByRole('button', { name: /Search docs/i }));

    const input = await screen.findByPlaceholderText(/Search documentation/i);

    // Act
    fireEvent.change(input, { target: { value: 'sonar' } });

    // Assert
    expect(await screen.findByText('Sonar')).toBeInTheDocument();
    expect(screen.queryByText('Board')).not.toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByText('Sonar'));

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/docs/guides/SONAR');
  });
});
