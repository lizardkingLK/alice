import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessAllowlistRegistry } from '@/app/access-allowlist/_components/access-allowlist-registry';
import { deleteAccessAllowlistEntry } from '@/app/access-allowlist/_services/accessAllowlist.service';
import { accessAllowlistFactory } from '../factories/accessAllowlist.factory';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams('tab=allowlist');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
  }),
  usePathname: () => '/users',
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
    toString: () => mockSearchParams.toString(),
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
    initialKind,
    initialValue,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
    initialKind?: string;
    initialValue?: string;
  }) => (
    <div data-testid="mock-allowlist-form">
      <span data-testid="mock-kind">{initialKind}</span>
      <span data-testid="mock-value">{initialValue}</span>
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
    mockSearchParams = new URLSearchParams('tab=allowlist');
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
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete$/i })[0]!);
    expect(
      await screen.findByText(/Delete allowlist entry/i)
    ).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/i });
    fireEvent.click(deleteButtons.at(-1)!);

    // Assert
    await waitFor(() => {
      expect(deleteAccessAllowlistEntry).toHaveBeenCalledWith(
        'allow-1',
        entries[0]!.updated_at
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('disables Delete for the domain that matches the current user email', () => {
    render(
      <AccessAllowlistRegistry
        entries={entries}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        search=""
        currentUserEmail="admin@acme.com"
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/i });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).toBeEnabled();
  });

  it('automatically opens the add entry dialog and populates it when addEmail query param is present', () => {
    // Arrange
    mockSearchParams = new URLSearchParams('tab=allowlist&addEmail=user@example.com');

    // Act
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
    expect(screen.getByTestId('mock-allowlist-form')).toBeInTheDocument();
    expect(screen.getByTestId('mock-kind')).toHaveTextContent('email');
    expect(screen.getByTestId('mock-value')).toHaveTextContent('user@example.com');
  });

  it('clears the addEmail query parameter from the URL when close is triggered', async () => {
    // Arrange
    mockSearchParams = new URLSearchParams('tab=allowlist&addEmail=user@example.com');
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

    // Act (Close)
    fireEvent.click(screen.getByRole('button', { name: /Close Form/i }));

    // Assert (replace was called with url omitting addEmail)
    expect(mockReplace).toHaveBeenCalledWith('/users?tab=allowlist');
  });

  it('clears the addEmail query parameter from the URL and refreshes when success is triggered', async () => {
    // Arrange
    mockSearchParams = new URLSearchParams('tab=allowlist&addEmail=user@example.com');
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

    // Act (Success)
    fireEvent.click(screen.getByRole('button', { name: /Success Form/i }));

    // Assert (replace was called again, and refresh was called)
    expect(mockReplace).toHaveBeenCalledWith('/users?tab=allowlist');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
