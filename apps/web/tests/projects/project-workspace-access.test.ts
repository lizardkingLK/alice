import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveMemberProjectIdsMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/board/_services/board.reads.defaults.server', () => ({
  getActiveMemberProjectIds: getActiveMemberProjectIdsMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import {
  canAccessProjectWorkspace,
  isProjectOwner,
  listAccessibleProjectIds,
} from '@/lib/projects/project-workspace-access';

type OwnerRow = { id: string } | null;

function mockSupabase(options?: {
  readonly ownerRow?: OwnerRow;
  readonly ownedIds?: string[];
  readonly email?: string;
  readonly allowedProjectIds?: string[] | null;
  readonly projectsByKey?: Array<{ id: string; key: string }>;
}) {
  const ownerRow = options?.ownerRow ?? null;
  const ownedIds = options?.ownedIds ?? [];
  const email = options?.email ?? 'user@example.com';
  const allowedProjectIds = options?.allowedProjectIds ?? null;
  const projectsByKey = options?.projectsByKey ?? [];

  createClientMock.mockResolvedValue({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        maybeSingle: async () => {
          if (table === 'users') {
            return { data: { email }, error: null };
          }
          if (table === 'access_allowlist') {
            return { data: allowedProjectIds ? { allowed_project_ids: allowedProjectIds } : null, error: null };
          }
          if (table === 'projects') {
            return { data: ownerRow, error: null };
          }
          return { data: null, error: null };
        },
        then(
          onFulfilled?: () => unknown,
          onRejected?: () => unknown
        ) {
          if (table === 'projects') {
            const listResult = {
              data: projectsByKey.length > 0
                ? projectsByKey
                : ownedIds.map((id) => ({ id })),
              error: null,
            };
            return Promise.resolve(listResult).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        }
      };
      return chain;
    },
  });
}

describe('canAccessProjectWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveMemberProjectIdsMock.mockResolvedValue([]);
    mockSupabase();
  });

  it('allows admins without membership', async () => {
    await expect(
      canAccessProjectWorkspace('user-1', 'admin', 'project-1')
    ).resolves.toBe(true);
    expect(getActiveMemberProjectIdsMock).not.toHaveBeenCalled();
  });

  it('allows active project members', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['project-1']);

    await expect(
      canAccessProjectWorkspace('user-1', 'manager', 'project-1')
    ).resolves.toBe(true);
  });

  it('denies managers who are not members or owners', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['other-project']);

    await expect(
      canAccessProjectWorkspace('user-1', 'manager', 'project-1')
    ).resolves.toBe(false);
  });

  it('allows project owners who are not in project_members', async () => {
    mockSupabase({ ownerRow: { id: 'project-1' } });

    await expect(isProjectOwner('user-1', 'project-1')).resolves.toBe(true);
    await expect(
      canAccessProjectWorkspace('user-1', 'manager', 'project-1')
    ).resolves.toBe(true);
  });
});

describe('listAccessibleProjectIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveMemberProjectIdsMock.mockResolvedValue([]);
    mockSupabase();
  });

  it('returns all for admins', async () => {
    await expect(listAccessibleProjectIds('user-1', 'admin')).resolves.toBe(
      'all'
    );
  });

  it('unions member and owned project ids for managers', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['member-project']);
    mockSupabase({ ownedIds: ['owned-project', 'member-project'] });

    await expect(
      listAccessibleProjectIds('user-1', 'manager')
    ).resolves.toEqual(['member-project', 'owned-project']);
  });

  it('restricts accessible projects for guest user matching allowlist ACL', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['member-project', 'other-project']);
    mockSupabase({
      ownedIds: [],
      allowedProjectIds: ['SG'],
      projectsByKey: [{ id: 'member-project', key: 'SG' }],
    });

    await expect(
      listAccessibleProjectIds('user-1', 'member')
    ).resolves.toEqual(['member-project']);
  });
});
