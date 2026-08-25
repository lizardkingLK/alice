import type { AccessAllowlistEntry } from '@/app/access-allowlist/_services/accessAllowlist.service';

export const accessAllowlistFactory = {
  build(overrides: Partial<AccessAllowlistEntry> = {}): AccessAllowlistEntry {
    return {
      id: 'allowlist-123',
      kind: 'domain',
      value: 'acme.com',
      label: 'Acme corp',
      expires_at: null,
      allowed_project_ids: null,
      status: 'active',
      created_at: '2026-07-09T10:00:00Z',
      updated_at: '2026-07-09T10:00:00Z',
      created_by: null,
      updated_by: null,
      ...overrides,
    };
  },

  buildEmail(
    overrides: Partial<AccessAllowlistEntry> = {}
  ): AccessAllowlistEntry {
    return accessAllowlistFactory.build({
      id: 'allowlist-email-1',
      kind: 'email',
      value: 'client@partner.com',
      label: 'Pilot client',
      ...overrides,
    });
  },

  buildList(
    count: number,
    overrides: Partial<AccessAllowlistEntry> = {}
  ): AccessAllowlistEntry[] {
    return Array.from({ length: count }, (_, index) =>
      accessAllowlistFactory.build({
        id: `allowlist-${index + 1}`,
        value: `org${index + 1}.com`,
        label: `Org ${index + 1}`,
        ...overrides,
      })
    );
  },
};
