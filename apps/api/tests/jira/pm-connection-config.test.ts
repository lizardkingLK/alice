import { describe, expect, it } from 'vitest';
import {
  buildJiraProviderConfig,
  parseJiraProviderConfig,
  tryParseJiraProviderConfig,
} from '@repo/types';

describe('jira provider_config helpers', () => {
  it('builds a validated Jira config', () => {
    expect(
      buildJiraProviderConfig({
        site_url: 'https://acme.atlassian.net',
        account_email: 'a@b.com',
      })
    ).toEqual({
      site_url: 'https://acme.atlassian.net',
      account_email: 'a@b.com',
    });
  });

  it('parses stored JSON', () => {
    expect(
      parseJiraProviderConfig({
        site_url: 'https://acme.atlassian.net',
        account_email: null,
      })
    ).toEqual({
      site_url: 'https://acme.atlassian.net',
      account_email: null,
    });
  });

  it('returns null for invalid config without throwing', () => {
    expect(tryParseJiraProviderConfig({ site_url: '' })).toBeNull();
    expect(tryParseJiraProviderConfig(null)).toBeNull();
  });
});
