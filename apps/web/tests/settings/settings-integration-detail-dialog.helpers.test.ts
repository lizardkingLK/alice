import { describe, expect, it } from 'vitest';
import type { IntegrationWire } from '@repo/types';
import {
  configuredModelLabel,
  createFormStateForNewModel,
  createFormStateFromRow,
  integrationApiKeyPlaceholder,
  integrationDialogStatusLabel,
  integrationSaveButtonLabel,
} from '@/app/settings/_components/settings-integration-detail-dialog.helpers';
import { WORKSPACE_INTEGRATIONS } from '@/app/settings/_components/settings-integration-catalog';

const chatRow: IntegrationWire = {
  id: '11111111-1111-4111-8111-111111111111',
  catalog_id: 'alice-gemini',
  category: 'ai_agent',
  provider: 'gemini',
  name: 'Gemini 3.6',
  status: 'active',
  config: {
    kind: 'chat_model',
    model: 'gemini-3.6-flash',
    display_label: 'Gemini 3.6',
    has_api_key: true,
  },
  is_default: true,
  sort_order: 0,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
} satisfies IntegrationWire;

describe('integrationSaveButtonLabel', () => {
  it('returns connecting copy for new models', () => {
    expect(integrationSaveButtonLabel(true, false)).toBe('Connecting...');
    expect(integrationSaveButtonLabel(false, false)).toBe('Connect model');
  });

  it('returns saving copy for existing rows', () => {
    expect(integrationSaveButtonLabel(true, true)).toBe('Saving...');
    expect(integrationSaveButtonLabel(false, true)).toBe('Save changes');
  });
});

describe('integrationApiKeyPlaceholder', () => {
  it('prompts to keep the existing key when one is configured', () => {
    expect(integrationApiKeyPlaceholder(chatRow)).toBe(
      'Leave blank to keep existing key'
    );
  });
});

describe('configuredModelLabel', () => {
  it('appends default suffix for workspace default rows', () => {
    expect(configuredModelLabel(chatRow)).toBe('Gemini 3.6 (default)');
  });
});

describe('createFormStateFromRow', () => {
  it('hydrates form fields from a configured chat model row', () => {
    expect(createFormStateFromRow(chatRow)).toMatchObject({
      selectedRowId: chatRow.id,
      modelId: 'gemini-3.6-flash',
      displayLabel: 'Gemini 3.6',
      isDefault: true,
    });
  });
});

describe('createFormStateForNewModel', () => {
  it('marks the first model as default when none exist', () => {
    expect(createFormStateForNewModel([]).isDefault).toBe(true);
    expect(createFormStateForNewModel([chatRow]).isDefault).toBe(false);
  });
});

describe('integrationDialogStatusLabel', () => {
  it('shows connected when an active chat model has an API key', () => {
    const integration = WORKSPACE_INTEGRATIONS.find(
      (item) => item.id === 'alice-gemini'
    )!;

    expect(integrationDialogStatusLabel(integration, [chatRow])).toBe(
      'Connected'
    );
  });
});
