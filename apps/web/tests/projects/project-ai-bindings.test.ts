import { describe, expect, it } from 'vitest';
import { mapAiBindingsToIntegrationBindings } from '@/app/projects/_helpers/project-ai-bindings';

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
