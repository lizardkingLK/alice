import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveMemberProjectIdsMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/board/_services/board-defaults.server', () => ({
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

function createMaybeSingle(ownerRow: OwnerRow) {
  return vi.fn().mockResolvedValue({ data: ownerRow, error: null });
}

function createOwnedListResult(ownedIds: string[]) {
  return {
    data: ownedIds.map((id) => ({ id })),
    error: null,
  };
}

/** Flat builder: supports `.eq().eq().maybeSingle()` and awaitable `.eq()`. */
function createProjectsQueryBuilder(ownerRow: OwnerRow, ownedIds: string[]) {
  const listResult = createOwnedListResult(ownedIds);
  const maybeSingle = createMaybeSingle(ownerRow);

  return {
    eq() {
      return {
        eq() {
          return { maybeSingle };
        },
        then(
          onFulfilled?: Parameters<Promise<typeof listResult>['then']>[0],
          onRejected?: Parameters<Promise<typeof listResult>['then']>[1]
        ) {
          return Promise.resolve(listResult).then(onFulfilled, onRejected);
        },
      };
    },
  };
}

function mockSupabase(options?: {
  readonly ownerRow?: OwnerRow;
  readonly ownedIds?: string[];
}) {
  const ownerRow = options?.ownerRow ?? null;
  const ownedIds = options?.ownedIds ?? [];
  const queryBuilder = createProjectsQueryBuilder(ownerRow, ownedIds);

  createClientMock.mockResolvedValue({
    from: () => ({
      select: () => queryBuilder,
    }),
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
});
