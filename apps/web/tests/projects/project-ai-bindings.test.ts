import { describe, expect, it } from 'vitest';
import {
  mapAiBindingsToIntegrationBindings,
  toggleAiBindingSelection,
} from '@/app/projects/_helpers/project-ai-bindings';

describe('mapAiBindingsToIntegrationBindings', () => {
  it('returns undefined when no models are selected', () => {
    expect(mapAiBindingsToIntegrationBindings([], null)).toBeUndefined();
  });

  it('maps selected ids and marks the project default', () => {
    expect(
      mapAiBindingsToIntegrationBindings(['model-a', 'model-b'], 'model-b')
    ).toEqual([
      { integration_id: 'model-a', is_default_for_project: false },
      { integration_id: 'model-b', is_default_for_project: true },
    ]);
  });

  it('marks no default when the default id is null', () => {
    expect(mapAiBindingsToIntegrationBindings(['model-a'], null)).toEqual([
      { integration_id: 'model-a', is_default_for_project: false },
    ]);
  });
});

describe('toggleAiBindingSelection', () => {
  it('adds a model and sets it as default when none exists', () => {
    expect(
      toggleAiBindingSelection(
        { aiBindingIds: [], defaultAiIntegrationId: null },
        'model-a',
        true
      )
    ).toEqual({
      aiBindingIds: ['model-a'],
      defaultAiIntegrationId: 'model-a',
    });
  });

  it('removes a model and falls back to the next default', () => {
    expect(
      toggleAiBindingSelection(
        {
          aiBindingIds: ['model-a', 'model-b'],
          defaultAiIntegrationId: 'model-a',
        },
        'model-a',
        false
      )
    ).toEqual({
      aiBindingIds: ['model-b'],
      defaultAiIntegrationId: 'model-b',
    });
  });
});
