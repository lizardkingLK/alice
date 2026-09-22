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
  const hasAllowlistRow = options?.allowedProjectIds !== undefined;

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
            if (!hasAllowlistRow) {
              return { data: null, error: null };
            }
            return {
              data: { allowed_project_ids: allowedProjectIds },
              error: null,
            };
          }
          if (table === 'projects') {
            return { data: ownerRow, error: null };
          }
          return { data: null, error: null };
        },
        then(onFulfilled?: () => unknown, onRejected?: () => unknown) {
          if (table === 'projects') {
            const listResult = {
              data:
                projectsByKey.length > 0
                  ? projectsByKey
                  : ownedIds.map((id) => ({ id })),
              error: null,
            };
            return Promise.resolve(listResult).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: null, error: null }).then(
            onFulfilled,
            onRejected
          );
        },
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

  it('denies admins without membership or ownership (my-projects mode)', async () => {
    await expect(
      canAccessProjectWorkspace('user-1', 'project-1')
    ).resolves.toBe(false);
  });

  it('allows admins who are active project members', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['project-1']);

    await expect(
      canAccessProjectWorkspace('user-1', 'project-1')
    ).resolves.toBe(true);
  });

  it('allows active project members', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['project-1']);

    await expect(
      canAccessProjectWorkspace('user-1', 'project-1')
    ).resolves.toBe(true);
  });

  it('denies managers who are not members or owners', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['other-project']);

    await expect(
      canAccessProjectWorkspace('user-1', 'project-1')
    ).resolves.toBe(false);
  });

  it('allows project owners who are not in project_members', async () => {
    mockSupabase({ ownerRow: { id: 'project-1' } });

    await expect(isProjectOwner('user-1', 'project-1')).resolves.toBe(true);
    await expect(
      canAccessProjectWorkspace('user-1', 'project-1')
    ).resolves.toBe(true);
  });

  it('allows email guests only for allowlisted project ids', async () => {
    mockSupabase({
      allowedProjectIds: ['SG'],
      projectsByKey: [{ id: 'acl-project', key: 'SG' }],
    });
    getActiveMemberProjectIdsMock.mockResolvedValue(['other-project']);

    await expect(
      canAccessProjectWorkspace('user-1', 'acl-project')
    ).resolves.toBe(true);
    await expect(
      canAccessProjectWorkspace('user-1', 'other-project')
    ).resolves.toBe(false);
  });

  it('denies email guests when allowlist project keys are empty', async () => {
    mockSupabase({ allowedProjectIds: [] });
    getActiveMemberProjectIdsMock.mockResolvedValue(['member-project']);

    await expect(
      canAccessProjectWorkspace('user-1', 'member-project')
    ).resolves.toBe(false);
  });
});

describe('listAccessibleProjectIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveMemberProjectIdsMock.mockResolvedValue([]);
    mockSupabase();
  });

  it('returns membership ∪ owned ids for admins (not all projects)', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['member-project']);
    mockSupabase({ ownedIds: ['owned-project'] });

    await expect(listAccessibleProjectIds('user-1')).resolves.toEqual([
      'member-project',
      'owned-project',
    ]);
  });

  it('unions member and owned project ids for managers', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['member-project']);
    mockSupabase({ ownedIds: ['owned-project', 'member-project'] });

    await expect(listAccessibleProjectIds('user-1')).resolves.toEqual([
      'member-project',
      'owned-project',
    ]);
  });

  it('returns allowlist project ids for email guests without requiring membership', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['other-project']);
    mockSupabase({
      ownedIds: [],
      allowedProjectIds: ['SG'],
      projectsByKey: [{ id: 'acl-project', key: 'SG' }],
    });

    await expect(listAccessibleProjectIds('user-1')).resolves.toEqual([
      'acl-project',
    ]);
  });

  it('returns an empty list for email guests with no allowlisted projects', async () => {
    getActiveMemberProjectIdsMock.mockResolvedValue(['member-project']);
    mockSupabase({
      ownedIds: [],
      allowedProjectIds: [],
    });

    await expect(listAccessibleProjectIds('user-1')).resolves.toEqual([]);
  });
});
