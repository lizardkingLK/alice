import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditProfilePreferencesCard } from '@/app/edit-profile/_components/edit-profile-preferences-card';
import {
  readWorkItemCreateFormMode,
  writeWorkItemCreateFormMode,
} from '@/app/work-items/_helpers/work-item-create-form-preference';
import {
  readProjectCreationDraftAuto,
  writeProjectCreationDraftAuto,
} from '@/app/projects/_helpers/project-creation-draft-preference';

describe('EditProfilePreferencesCard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hydrates the modern create switch from localStorage', async () => {
    writeWorkItemCreateFormMode('modern');

    render(<EditProfilePreferencesCard userId="user-1" />);

    const toggle = await screen.findByRole('switch', {
      name: /Modern work item create/i,
    });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });

  it('persists modern create when the switch is enabled', async () => {
    render(<EditProfilePreferencesCard userId="user-1" />);

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

  it('hydrates and persists auto-save project drafts', async () => {
    writeProjectCreationDraftAuto('user-1', true);

    render(<EditProfilePreferencesCard userId="user-1" />);

    const toggle = await screen.findByRole('switch', {
      name: /Auto-save project drafts/i,
    });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });

    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(readProjectCreationDraftAuto('user-1')).toBe(false);
  });

  it('shows work item details configure controls', async () => {
    render(<EditProfilePreferencesCard userId="user-1" />);

    expect(await screen.findByText('Work item details')).toBeInTheDocument();
    expect(screen.getByLabelText('Type color')).toBeInTheDocument();
    expect(screen.getByLabelText('Linked issues')).toBeInTheDocument();
  });
});
