import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FigmaSettingsCard } from '@/app/projects/_components/project-details/figma-settings-card';
import { FIGMA_PROJECT_URL_MESSAGE } from '@repo/types';
import { projectFactory } from '../factories/project.factory';

const mockSave = vi.fn();
const mockSetFailure = vi.fn();

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

describe('FigmaSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue(true);
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
});
