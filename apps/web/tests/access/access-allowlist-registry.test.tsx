import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessAllowlistRegistry } from '@/app/access-allowlist/_components/access-allowlist-registry';
import { deleteAccessAllowlistEntry } from '@/app/access-allowlist/_services/accessAllowlist.service';
import { accessAllowlistFactory } from '../factories/accessAllowlist.factory';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: vi.fn(),
  }),
  usePathname: () => '/users',
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'search') return '';
      if (key === 'page') return '1';
      if (key === 'limit') return '10';
      if (key === 'tab') return 'allowlist';
      return null;
    },
    toString: () => 'tab=allowlist',
  }),
}));

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/access-allowlist/_services/accessAllowlist.service', () => ({
  deleteAccessAllowlistEntry: vi.fn(),
}));

vi.mock('@/app/access-allowlist/_components/access-allowlist-form', () => ({
  AccessAllowlistForm: ({
    onClose,
    onSuccess,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
  }) => (
    <div data-testid="mock-allowlist-form">
      <button type="button" onClick={onClose}>
        Close Form
      </button>
      <button type="button" onClick={onSuccess}>
        Success Form
      </button>
    </div>
  ),
}));

const entries = [
  accessAllowlistFactory.build({
    id: 'allow-1',
    value: 'acme.com',
    label: 'Acme',
  }),
  accessAllowlistFactory.buildEmail({
    id: 'allow-2',
    value: 'client@partner.com',
  }),
];

describe('AccessAllowlistRegistry', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders allowlist rows and search controls', () => {
    // Arrange / Act
    render(
      <AccessAllowlistRegistry
        entries={entries}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        search=""
      />
    );

    // Assert
    expect(screen.getByText('acme.com')).toBeInTheDocument();
    expect(screen.getByText('client@partner.com')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search domains, emails, or labels/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
  });

  it('debounces search input into the URL', async () => {
    // Arrange
    render(
      <AccessAllowlistRegistry
        entries={entries}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        search=""
      />
    );

    // Act
    fireEvent.change(
      screen.getByPlaceholderText(/Search domains, emails, or labels/i),
      { target: { value: 'acme' } }
    );

    // Assert
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith(
          '/users?tab=allowlist&search=acme&page=1'
        );
      },
      { timeout: 1000 }
    );
  });

  it('navigates to the next page when pagination page 2 is clicked', () => {
    // Arrange
    render(
      <AccessAllowlistRegistry
        entries={entries}
        totalCount={20}
        page={1}
        limit={10}
        totalPages={2}
        search=""
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      '/users?tab=allowlist&page=2&limit=10'
    );
  });

  it('opens the add form dialog', () => {
    // Arrange
    render(
      <AccessAllowlistRegistry
        entries={entries}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        search=""
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Add entry/i }));

    // Assert
    expect(screen.getByTestId('mock-allowlist-form')).toBeInTheDocument();
  });

  it('deletes an entry after confirmation', async () => {
    // Arrange
    vi.mocked(deleteAccessAllowlistEntry).mockResolvedValue(undefined);
    render(
      <AccessAllowlistRegistry
        entries={entries}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        search=""
      />
    );

    // Act — dropdown mock keeps row actions visible
    fireEvent.click(screen.getAllByRole('button', { name: /^Remove$/i })[0]!);
    expect(
      await screen.findByText(/Remove allowlist entry/i)
    ).toBeInTheDocument();
    const removeButtons = screen.getAllByRole('button', { name: /^Remove$/i });
    fireEvent.click(removeButtons.at(-1)!);

    // Assert
    await waitFor(() => {
      expect(deleteAccessAllowlistEntry).toHaveBeenCalledWith('allow-1');
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
