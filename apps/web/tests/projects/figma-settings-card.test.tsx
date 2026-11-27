import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FigmaSettingsCard } from '@/app/projects/_components/project-details/figma-settings-card';
import { FIGMA_PROJECT_URL_MESSAGE } from '@repo/types';
import { projectFactory } from '../factories/project.factory';

const mockSave = vi.fn();
const mockSetFailure = vi.fn();
const {
  figmaHookState,
  mockRefreshConnection,
  mockVerifyDesignAccess,
  mockDisconnect,
  mockHandleConnect,
} = vi.hoisted(() => ({
  figmaHookState: { connection: null as Record<string, unknown> | null },
  mockRefreshConnection: vi.fn(),
  mockVerifyDesignAccess: vi.fn(),
  mockDisconnect: vi.fn(),
  mockHandleConnect: vi.fn(),
}));

vi.mock('@/app/projects/_hooks/use-integration-settings-save', () => ({
  useIntegrationSettingsSave: () => ({
    isSaving: false,
    message: null,
    isError: false,
    clearFeedback: vi.fn(),
    setFailure: mockSetFailure,
    save: mockSave,
  }),
}));

vi.mock('@/app/projects/_hooks/use-figma-connection', () => ({
  useFigmaConnection: () => ({
    connection: figmaHookState.connection,
    isLoading: false,
    isConnecting: false,
    isVerifying: false,
    isDisconnecting: false,
    loadError: null,
    refresh: mockRefreshConnection,
    verify: mockVerifyDesignAccess,
    disconnect: mockDisconnect,
    handleConnect: mockHandleConnect,
  }),
}));

describe('FigmaSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    figmaHookState.connection = null;
    mockSave.mockResolvedValue(true);
    mockVerifyDesignAccess.mockResolvedValue(true);
  });

  it('saves one valid Figma URL for the current project', async () => {
    render(
      <FigmaSettingsCard
        project={projectFactory.build({ id: 'project-a' })}
        canEditProject={true}
      />
    );

    const input = screen.getByLabelText('Figma URL');
    fireEvent.change(input, {
      target: { value: 'https://www.figma.com/design/file-a/Alice' },
    });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        figma_url: 'https://www.figma.com/design/file-a/Alice',
      });
    });
  });

  it('shows the persisted link again after the card remounts', () => {
    const project = projectFactory.build({
      figma_url: 'https://www.figma.com/proto/file-a/Alice',
    });
    const first = render(
      <FigmaSettingsCard project={project} canEditProject={true} />
    );

    expect(screen.getByRole('link', { name: 'Open Figma' })).toHaveAttribute(
      'href',
      project.figma_url
    );

    first.unmount();
    render(<FigmaSettingsCard project={project} canEditProject={true} />);
    expect(screen.getByRole('link', { name: 'Open Figma' })).toHaveAttribute(
      'href',
      project.figma_url
    );
  });

  it('removes the saved link', async () => {
    render(
      <FigmaSettingsCard
        project={projectFactory.build({
          figma_url: 'https://www.figma.com/board/file-a/Alice',
        })}
        canEditProject={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({ figma_url: null });
    });
    expect(screen.getByLabelText('Figma URL')).toHaveValue('');
  });

  it('rejects a non-Figma URL before saving', () => {
    render(
      <FigmaSettingsCard
        project={projectFactory.build()}
        canEditProject={true}
      />
    );

    const input = screen.getByLabelText('Figma URL');
    fireEvent.change(input, {
      target: { value: 'https://example.com/design/file-a' },
    });
    fireEvent.submit(input.closest('form')!);

    expect(mockSetFailure).toHaveBeenCalledWith(FIGMA_PROJECT_URL_MESSAGE);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('lets a member open the link but not change it', () => {
    render(
      <FigmaSettingsCard
        project={projectFactory.build({
          figma_url: 'https://www.figma.com/design/file-a/Alice',
        })}
        canEditProject={false}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Open Figma' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit link' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove link' })
    ).not.toBeInTheDocument();
  });

  it('shows connection and current design verification as separate statuses', () => {
    figmaHookState.connection = {
      connected: true,
      design_access_verified: false,
      authorized_by_name: 'Alice Manager',
      verification_error: 'The connected account cannot access this file.',
    };

    render(
      <FigmaSettingsCard
        project={projectFactory.build({
          figma_url: 'https://www.figma.com/design/file-a/Alice',
        })}
        canEditProject={true}
      />
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Not verified')).toBeInTheDocument();
    expect(screen.getByText('Alice Manager')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Verify design access' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reconnect Figma' })
    ).toBeInTheDocument();
  });

  it('preserves the active connection when the saved link changes', async () => {
    figmaHookState.connection = {
      connected: true,
      design_access_verified: true,
      authorized_by_name: 'Alice Manager',
    };
    render(
      <FigmaSettingsCard
        project={projectFactory.build({
          figma_url: 'https://www.figma.com/design/file-a/Alice',
        })}
        canEditProject={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit link' }));
    const input = screen.getByLabelText('Figma URL');
    fireEvent.change(input, {
      target: { value: 'https://www.figma.com/design/file-b/Bob' },
    });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(mockVerifyDesignAccess).toHaveBeenCalled());
    expect(mockDisconnect).not.toHaveBeenCalled();
  });
});
