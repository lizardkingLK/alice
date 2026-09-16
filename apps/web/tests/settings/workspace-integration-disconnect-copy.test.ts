import { describe, expect, it } from 'vitest';
import { workspaceIntegrationDisconnectCopy } from '@/app/settings/_helpers/workspace-integration-disconnect-copy';

describe('workspaceIntegrationDisconnectCopy', () => {
  it('uses hard-disconnect wording for the confirmation dialog', () => {
    const copy = workspaceIntegrationDisconnectCopy('Google Gemini');

    expect(copy.title).toBe('Disconnect integration');
    expect(copy.subject).toBe('Google Gemini');
    expect(copy.confirmLabel).toBe('Disconnect');
    expect(copy.actionVerb).toBe('disconnect');
    expect(copy.detail).toMatch(/Warning:/);
    expect(copy.detail).toMatch(/whole workspace/i);
    expect(copy.detail).toMatch(/chat models/i);
  });
});
