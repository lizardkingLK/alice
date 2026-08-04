import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditProfilePreferencesCard } from '@/app/edit-profile/_components/edit-profile-preferences-card';
import {
  readWorkItemCreateFormMode,
  writeWorkItemCreateFormMode,
} from '@/app/work-items/_helpers/work-item-create-form-preference';

describe('EditProfilePreferencesCard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hydrates the modern create switch from localStorage', async () => {
    writeWorkItemCreateFormMode('modern');

    render(<EditProfilePreferencesCard />);

    const toggle = await screen.findByRole('switch', {
      name: /Modern work item create/i,
    });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });

  it('persists modern create when the switch is enabled', async () => {
    render(<EditProfilePreferencesCard />);

    const toggle = await screen.findByRole('switch', {
      name: /Modern work item create/i,
    });
    await waitFor(() => {
      expect(toggle).not.toBeDisabled();
    });

    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(readWorkItemCreateFormMode()).toBe('modern');
  });
});
