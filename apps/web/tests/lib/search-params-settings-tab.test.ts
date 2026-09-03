import { describe, expect, it } from 'vitest';
import {
  parseSettingsTab,
  resolveSettingsTabForUser,
} from '@/lib/search-params';

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

describe('resolveSettingsTabForUser', () => {
  it('coerces integrations to general for non-admin users', () => {
    expect(resolveSettingsTabForUser('integrations', false)).toBe('general');
  });

  it('keeps integrations for admins and other tabs for everyone', () => {
    expect(resolveSettingsTabForUser('integrations', true)).toBe(
      'integrations'
    );
    expect(resolveSettingsTabForUser('security', false)).toBe('security');
    expect(resolveSettingsTabForUser('general', true)).toBe('general');
  });
});
