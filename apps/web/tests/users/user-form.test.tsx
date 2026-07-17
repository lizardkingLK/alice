import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserForm } from '@/app/users/_components/user-form';
import { createUser, updateUser } from '@/app/users/_services/users.service';
import type { User } from '@/app/users/_services/users.service';

vi.mock('@/app/users/_services/users.service', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

const mockUser: User = {
  id: 'user-123',
  name: 'Erlich Bachman',
  email: 'erlich@bachmanity.com',
  role: 'member',
  active: true,
  created_at: '2026-07-09T10:00:00Z',
  updated_at: '2026-07-09T10:00:00Z',
  created_by: null,
  profile_picture: null,
  status: 'active',
  updated_by: null,
};

describe('UserForm Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders input fields and role dropdown', () => {
    render(<UserForm />);

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Workspace Role/i)).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    render(<UserForm />);

    const form = screen.getByLabelText(/Full Name/i).closest('form')!;
    fireEvent.submit(form);

    expect(
      await screen.findByText(/Name, email, and role are required/i)
    ).toBeInTheDocument();
  });

  it('submits correctly in create mode and calls onSuccess callback', async () => {
    const onSuccess = vi.fn();
    vi.mocked(createUser).mockResolvedValue(mockUser);
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

    render(<UserForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Erlich Bachman' },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'erlich@bachmanity.com' },
    });
    const roleSelect = screen.getByLabelText(/Workspace Role/i);
    fireEvent.click(roleSelect);
    const option = screen.getByRole('option', { name: 'Member' });
    fireEvent.click(option);

    const form = screen.getByLabelText(/Full Name/i).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        name: 'Erlich Bachman',
        email: 'erlich@bachmanity.com',
        role: 'member',
        redirectTo:
          'http://localhost:3000/auth/callback?next=%2Freset-password',
      });
    });

    expect(
      await screen.findByText(/User added successfully! Sending invitation.../i)
    ).toBeInTheDocument();

    // Wait for the success timeout of 1500ms
    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('populates fields and updates correctly in edit mode, disabling email changes', async () => {
    vi.mocked(updateUser).mockResolvedValue({
      ...mockUser,
      name: 'Erlich Bachman Updated',
      role: 'manager',
    });

    render(<UserForm user={mockUser} />);

    // Email should be disabled in edit mode
    const emailInput = screen.getByLabelText(/Email Address/i);
    expect(emailInput).toBeDisabled();
    expect(emailInput).toHaveValue('erlich@bachmanity.com');

    // Name and Role should be populated
    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput).toHaveValue('Erlich Bachman');
    const roleSelect = screen.getByLabelText(/Workspace Role/i);
    expect(roleSelect).toHaveTextContent('Member');

    // Edit Name and Role
    fireEvent.change(nameInput, {
      target: { value: 'Erlich Bachman Updated' },
    });
    fireEvent.click(roleSelect);
    const managerOption = screen.getByRole('option', { name: 'Manager' });
    fireEvent.click(managerOption);

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-123', {
        name: 'Erlich Bachman Updated',
        role: 'manager',
      });
    });

    expect(
      await screen.findByText(/User details updated successfully!/i)
    ).toBeInTheDocument();
  });

  it('triggers onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<UserForm onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
