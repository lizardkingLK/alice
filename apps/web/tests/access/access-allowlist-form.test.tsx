import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessAllowlistForm } from '@/app/access-allowlist/_components/access-allowlist-form';
import {
  createAccessAllowlistEntry,
  updateAccessAllowlistEntry,
} from '@/app/access-allowlist/_services/access-allowlist.mutations.client';
import { accessAllowlistFactory } from '../factories/accessAllowlist.factory';
import { projectFactory } from '../factories/project.factory';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

vi.mock('@repo/ui/components/ui/select', () =>
  import('../mocks/select').then((module) => module.createSelectMock())
);

vi.mock(
  '@/app/access-allowlist/_services/access-allowlist.mutations.client',
  () => ({
    createAccessAllowlistEntry: vi.fn(),
    updateAccessAllowlistEntry: vi.fn(),
  })
);

const mockProjects: Project[] = [
  projectFactory.build({ id: 'proj-1', key: 'SG', name: 'Singapore' }),
  projectFactory.build({ id: 'proj-2', key: 'DEMO', name: 'Demo Project' }),
];

describe('AccessAllowlistForm', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders kind, value, label, expiry, and status fields', () => {
    // Arrange / Act
    render(<AccessAllowlistForm />);

    // Assert
    expect(screen.getByText(/^Kind$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Domain$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Label \(optional\)/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Expires on \(optional\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Status$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Add Entry/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Domain$/i)).not.toBeRequired();
  });

  it('renders kind and value from initialKind and initialValue props', () => {
    render(
      <AccessAllowlistForm
        initialKind="email"
        initialValue="test@example.com"
      />
    );

    expect(screen.getByText(/^Kind$/i)).toBeInTheDocument();
    const valueInput = screen.getByLabelText(/^Email$/i);
    expect(valueInput).toBeInTheDocument();
    expect(valueInput).toHaveValue('test@example.com');
  });

  it('rejects a bare hostname without a TLD via Zod alert', async () => {
    // Arrange
    render(<AccessAllowlistForm />);
    fireEvent.change(screen.getByLabelText(/^Domain$/i), {
      target: { value: 'fff' },
    });

    // Act
    fireEvent.submit(screen.getByLabelText(/^Domain$/i).closest('form')!);

    // Assert
    expect(
      await screen.findByText(/Enter a valid domain \(e\.g\. acme\.com\)/i)
    ).toBeInTheDocument();
    expect(createAccessAllowlistEntry).not.toHaveBeenCalled();
  });

  it('rejects an invalid email via Zod alert', async () => {
    // Arrange
    render(<AccessAllowlistForm />);
    const kindSelect = screen.getAllByTestId('ui-select')[0]!;
    fireEvent.change(kindSelect, { target: { value: 'email' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: 'not-an-email' },
    });

    // Act
    fireEvent.submit(screen.getByLabelText(/^Email$/i).closest('form')!);

    // Assert
    expect(
      await screen.findByText(/Please enter a valid email address/i)
    ).toBeInTheDocument();
    expect(createAccessAllowlistEntry).not.toHaveBeenCalled();
  });

  it('renders project checkboxes and tooltip for email kind', () => {
    render(
      <AccessAllowlistForm
        initialKind="email"
        initialValue="guest@partner.com"
        projects={[...mockProjects]}
      />
    );

    expect(screen.getByText(/^Allowed projects$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /These control which project workspaces the guest can open/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Singapore')).toBeInTheDocument();
    expect(screen.getByText('SG')).toBeInTheDocument();
  });

  it('requires at least one project for email entries', async () => {
    render(
      <AccessAllowlistForm
        initialKind="email"
        initialValue="guest@partner.com"
        projects={[...mockProjects]}
      />
    );

    fireEvent.submit(screen.getByLabelText(/^Email$/i).closest('form')!);

    expect(
      await screen.findByText(/Select at least one allowed project/i)
    ).toBeInTheDocument();
    expect(createAccessAllowlistEntry).not.toHaveBeenCalled();
  });

  it('creates an email entry with selected project keys', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSuccess = vi.fn();
    const entry = accessAllowlistFactory.buildEmail();
    vi.mocked(createAccessAllowlistEntry).mockResolvedValue(entry);

    render(
      <AccessAllowlistForm
        initialKind="email"
        initialValue="guest@partner.com"
        projects={[...mockProjects]}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Singapore/i }));
    fireEvent.submit(screen.getByLabelText(/^Email$/i).closest('form')!);

    await waitFor(() => {
      expect(createAccessAllowlistEntry).toHaveBeenCalledWith({
        kind: 'email',
        value: 'guest@partner.com',
        label: null,
        expires_at: null,
        allowed_project_ids: ['SG'],
        status: 'active',
      });
    });

    await vi.advanceTimersByTimeAsync(1200);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('creates an entry for a valid domain and calls onSuccess after delay', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSuccess = vi.fn();
    const entry = accessAllowlistFactory.build();
    vi.mocked(createAccessAllowlistEntry).mockResolvedValue(entry);

    render(<AccessAllowlistForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/^Domain$/i), {
      target: { value: 'fff.com' },
    });
    fireEvent.change(screen.getByLabelText(/Label \(optional\)/i), {
      target: { value: 'Acme corp' },
    });

    // Act
    fireEvent.submit(screen.getByLabelText(/^Domain$/i).closest('form')!);

    // Assert
    await waitFor(() => {
      expect(createAccessAllowlistEntry).toHaveBeenCalledWith({
        kind: 'domain',
        value: 'fff.com',
        label: 'Acme corp',
        expires_at: null,
        allowed_project_ids: null,
        status: 'active',
      });
    });
    expect(
      await screen.findByText(/Allowlist entry created/i)
    ).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1200);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('updates an entry in edit mode and disables kind/value', async () => {
    // Arrange
    const entry = accessAllowlistFactory.buildEmail({
      label: 'Pilot client',
      allowed_project_ids: ['SG'],
    });
    vi.mocked(updateAccessAllowlistEntry).mockResolvedValue({
      ...entry,
      label: 'Updated client',
    });

    render(<AccessAllowlistForm entry={entry} projects={[...mockProjects]} />);

    // Assert (edit mode locks identity fields)
    const valueInput = screen.getByLabelText(/^Email$/i);
    expect(valueInput).toBeDisabled();
    expect(valueInput).toHaveValue('client@partner.com');
    expect(screen.getByRole('checkbox', { name: /Singapore/i })).toBeChecked();
    expect(
      screen.getByRole('button', { name: /Save Changes/i })
    ).toBeInTheDocument();

    // Act
    fireEvent.change(screen.getByLabelText(/Label \(optional\)/i), {
      target: { value: 'Updated client' },
    });
    fireEvent.submit(valueInput.closest('form')!);

    // Assert
    await waitFor(() => {
      expect(updateAccessAllowlistEntry).toHaveBeenCalledWith(
        entry.id,
        {
          label: 'Updated client',
          expires_at: null,
          allowed_project_ids: ['SG'],
          status: 'active',
        },
        entry.updated_at
      );
    });
    expect(
      await screen.findByText(/Allowlist entry updated/i)
    ).toBeInTheDocument();
  });

  it('shows a dialog when the email domain is already allowlisted', async () => {
    const { EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE } =
      await import('@repo/types');
    vi.mocked(createAccessAllowlistEntry).mockRejectedValue(
      new Error(EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE)
    );

    render(
      <AccessAllowlistForm
        initialKind="email"
        initialValue="guest@partner.com"
        projects={[...mockProjects]}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Singapore/i }));
    fireEvent.submit(screen.getByLabelText(/^Email$/i).closest('form')!);

    expect(
      await screen.findByRole('dialog', { name: /Access denied/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Okay$/i })).toBeInTheDocument();
  });

  it('locks status when editing the current user own domain', () => {
    const entry = accessAllowlistFactory.build({
      kind: 'domain',
      value: 'alice.dev',
      status: 'active',
    });

    render(
      <AccessAllowlistForm entry={entry} currentUserEmail="admin@alice.dev" />
    );

    const statusSelect = screen.getAllByTestId('ui-select')[1];
    expect(statusSelect).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: /You cannot delete or deactivate the domain that matches your email/i,
      })
    ).toBeInTheDocument();
  });

  it('contains invisible scroll and overflow classes on the form card', () => {
    const { container } = render(<AccessAllowlistForm />);
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass('no-scrollbar');
    expect(card).toHaveClass('overflow-y-auto');
    expect(card).toHaveClass('max-h-[85vh]');
  });
});

