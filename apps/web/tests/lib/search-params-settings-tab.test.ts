import { describe, expect, it } from 'vitest';
import { parseSettingsTab } from '@/lib/search-params';

describe('parseSettingsTab', () => {
  it('returns general for missing or unknown tab', () => {
    expect(parseSettingsTab(undefined)).toBe('general');
    expect(parseSettingsTab(null)).toBe('general');
    expect(parseSettingsTab('')).toBe('general');
    expect(parseSettingsTab('billing')).toBe('general');
  });

  it('parses account settings tabs', () => {
    expect(parseSettingsTab('general')).toBe('general');
    expect(parseSettingsTab('security')).toBe('security');
    expect(parseSettingsTab('notifications')).toBe('notifications');
    expect(parseSettingsTab('preferences')).toBe('preferences');
  });

  it('parses admin-only integrations tab', () => {
    expect(parseSettingsTab('integrations')).toBe('integrations');
  });
});
