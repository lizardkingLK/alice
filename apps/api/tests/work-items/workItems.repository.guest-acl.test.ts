import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: {
    STORAGE_BUCKET_ATTACHMENTS: 'attachments',
    SUPABASE_URL: 'https://placeholder-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'placeholder-key',
  },
}));

import { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types';

describe('WorkItemRepository guest ACL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restricts accessible projects for guest user matching ACL', async () => {
    const fromMock = vi.fn((table: string) => {
      const filters: Record<string, string> = {};
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((column: string, next: string) => {
          filters[column] = next;
          return chain;
        }),
        in: vi.fn((_column: string, _next: string[]) => {
          return chain;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'users') {
            return {
              data: { role: 'member', email: 'guest@partner.com' },
              error: null,
            };
          }
          if (table === 'access_allowlist') {
            return {
              data: {
                allowed_project_ids: ['proj-1', 'proj-2'],
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        then: vi.fn(async (onfulfilled) => {
          if (table === 'project_members') {
            return onfulfilled?.({
              data: [{ project_id: 'proj-2' }, { project_id: 'proj-3' }],
              error: null,
            });
          }
          if (table === 'projects') {
            if (filters['owner_id']) {
              return onfulfilled?.({
                data: [],
                error: null,
              });
            }
            return onfulfilled?.({
              data: [{ id: 'proj-1' }, { id: 'proj-2' }],
              error: null,
            });
          }
          return onfulfilled?.({ data: null, error: null });
        }),
      };
      return chain;
    });

    const mockDb = { from: fromMock } as unknown as SupabaseClient<Database>;
    const repository = new WorkItemRepository(mockDb);

    // Guest has memberships: proj-2, proj-3.
    // Guest ACL allows: proj-1, proj-2.
    // Accessible should be intersection: proj-2.
    const result = await repository.listAccessibleProjectIds('user-guest');
    expect(result).toEqual(['proj-2']);
  });

  it('returns all memberships when guest user has no ACL', async () => {
    const fromMock = vi.fn((table: string) => {
      const filters: Record<string, string> = {};
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((column: string, next: string) => {
          filters[column] = next;
          return chain;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'users') {
            return {
              data: { role: 'member', email: 'guest@partner.com' },
              error: null,
            };
          }
          if (table === 'access_allowlist') {
            return {
              data: null, // no ACL
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        then: vi.fn(async (onfulfilled) => {
          if (table === 'project_members') {
            return onfulfilled?.({
              data: [{ project_id: 'proj-2' }, { project_id: 'proj-3' }],
              error: null,
            });
          }
          if (table === 'projects') {
            return onfulfilled?.({
              data: [],
              error: null,
            });
          }
          return onfulfilled?.({ data: null, error: null });
        }),
      };
      return chain;
    });

    const mockDb = { from: fromMock } as unknown as SupabaseClient<Database>;
    const repository = new WorkItemRepository(mockDb);

    const result = await repository.listAccessibleProjectIds('user-guest');
    expect(result).toEqual(['proj-2', 'proj-3']);
  });
});
