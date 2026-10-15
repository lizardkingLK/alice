import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { IntegrationWire } from '@repo/types';
import { SettingsIntegrationsView } from '@/app/settings/_components/settings-integrations-view';
import { mockRefresh, resetNextNavigationMock } from '../mocks/next-navigation';

const {
  createWorkspaceIntegrationMock,
  patchWorkspaceIntegrationMock,
  deleteWorkspaceIntegrationMock,
} = vi.hoisted(() => ({
  createWorkspaceIntegrationMock: vi.fn(),
  patchWorkspaceIntegrationMock: vi.fn(),
  deleteWorkspaceIntegrationMock: vi.fn(),
}));

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock('@/app/settings/_services/integrations.mutations.client', () => ({
  createWorkspaceIntegration: createWorkspaceIntegrationMock,
  patchWorkspaceIntegration: patchWorkspaceIntegrationMock,
  deleteWorkspaceIntegration: deleteWorkspaceIntegrationMock,
}));

const openAiRow: IntegrationWire = {
  id: '11111111-1111-4111-8111-111111111111',
  catalog_id: 'openai',
  category: 'ai_agent',
  provider: 'openai',
  name: 'GPT-4o',
  status: 'active',
  config: {
    kind: 'chat_model',
    model: 'gpt-4o',
    display_label: 'GPT-4o',
    has_api_key: true,
  },
  is_default: true,
  sort_order: 0,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('SettingsIntegrationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNextNavigationMock();
  });

  it('renders workspace integration cards and excludes the GitHub card', () => {
    render(<SettingsIntegrationsView initialIntegrations={[]} />);
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'OpenAI connected' })
    ).toBeEnabled();
    expect(
      screen.getByRole('switch', { name: 'Anthropic connected' })
    ).toBeEnabled();
    expect(screen.getByText('Slack')).toBeInTheDocument();
    // GitHub card must not appear on settings?tab=integrations
    expect(
      screen.queryByRole('heading', { name: 'GitHub' })
    ).not.toBeInTheDocument();
  });

  it('automatically opens detail dialog for workspace integration when autoOpenPopup is true', () => {
    render(
      <SettingsIntegrationsView
        initialIntegrations={[]}
        autoOpenPopup={true}
        autoOpenIntegration="alice-gemini"
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Google Gemini')).toBeInTheDocument();
  });

  it.each([
    ['openai', 'OpenAI', 'GPT-4o'],
    ['anthropic', 'Anthropic', 'Claude Sonnet 4'],
  ])(
    'opens the configuration dialog for %s',
    async (catalogId, providerName, suggestedModel) => {
      render(
        <SettingsIntegrationsView
          initialIntegrations={[]}
          autoOpenPopup={true}
          autoOpenIntegration={catalogId}
        />
      );

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(providerName)).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: suggestedModel })
      ).toBeInTheDocument();
      expect(within(dialog).getByLabelText('API key')).toHaveAttribute(
        'type',
        'password'
      );
      expect(
        within(dialog).getByRole('button', { name: 'Connect model' })
      ).toBeEnabled();
    }
  );

  it.each([
    ['openai', 'sk-openai-test', 'openai', 'gpt-4o', 'GPT-4o'],
    [
      'anthropic',
      'sk-ant-test',
      'anthropic',
      'claude-sonnet-4-20250514',
      'Claude Sonnet 4',
    ],
  ])(
    'creates an active %s configuration from the dialog',
    async (catalogId, apiKey, provider, model, displayLabel) => {
      createWorkspaceIntegrationMock.mockResolvedValue({});
      render(
        <SettingsIntegrationsView
          initialIntegrations={[]}
          autoOpenPopup={true}
          autoOpenIntegration={catalogId}
        />
      );

      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('API key'), {
        target: { value: apiKey },
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Connect model' })
      );

      await waitFor(() => {
        expect(createWorkspaceIntegrationMock).toHaveBeenCalledWith({
          catalog_id: catalogId,
          category: 'ai_agent',
          provider,
          name: displayLabel,
          status: 'active',
          is_default: true,
          config: {
            kind: 'chat_model',
            model,
            display_label: displayLabel,
            api_key: apiKey,
          },
        });
      });
    }
  );

  it('updates an OpenAI model without exposing or replacing its saved key', async () => {
    patchWorkspaceIntegrationMock.mockResolvedValue({});
    render(
      <SettingsIntegrationsView
        initialIntegrations={[openAiRow]}
        autoOpenPopup={true}
        autoOpenIntegration="openai"
      />
    );

    const dialog = await screen.findByRole('dialog');
    const apiKeyInput = within(dialog).getByLabelText('API key');
    expect(apiKeyInput).toHaveValue('');
    expect(apiKeyInput).toHaveAttribute(
      'placeholder',
      'Leave blank to keep existing key'
    );

    fireEvent.change(within(dialog).getByLabelText('Display label'), {
      target: { value: 'GPT-4o Production' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save changes' })
    );

    await waitFor(() => {
      expect(patchWorkspaceIntegrationMock).toHaveBeenCalledWith(openAiRow.id, {
        name: 'GPT-4o Production',
        status: 'active',
        is_default: true,
        config: {
          kind: 'chat_model',
          model: 'gpt-4o',
          display_label: 'GPT-4o Production',
        },
      });
    });
  });

  it('disables every active OpenAI model when the catalog switch is turned off', async () => {
    deleteWorkspaceIntegrationMock.mockResolvedValue(undefined);
    render(<SettingsIntegrationsView initialIntegrations={[openAiRow]} />);

    fireEvent.click(screen.getByRole('switch', { name: 'OpenAI connected' }));
    const confirmDialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(confirmDialog).getByRole('button', { name: 'Disconnect' })
    );

    await waitFor(() => {
      expect(deleteWorkspaceIntegrationMock).toHaveBeenCalledWith(openAiRow.id);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
