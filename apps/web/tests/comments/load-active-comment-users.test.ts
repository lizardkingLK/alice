import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadActiveCommentUsers } from '@/app/comments/_components/comments-feed';
import { createClient } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('loadActiveCommentUsers', () => {
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createClient>);
  });

  it('fetches project owners and members when workItemId is undefined or all', async () => {
    const mockOwner = {
      id: 'u-2',
      name: 'Owen Owner',
      email: 'owner@dev.com',
      role: 'member',
    };
    const mockMember = {
      id: 'u-3',
      name: 'Mona Member',
      email: 'member@dev.com',
      role: 'member',
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: async () => ({ data: [{ owner_id: 'u-2' }] }),
          }),
        };
      }
      if (table === 'project_members') {
        return {
          select: () => ({
            eq: async () => ({ data: [{ user_id: 'u-3' }] }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: (field: string, val: string) => {
              if (field === 'status' && val === 'active') {
                return {
                  in: () => Promise.resolve({ data: [mockOwner, mockMember] }),
                };
              }
              return Promise.resolve({ data: [] });
            },
          }),
        };
      }
      return {};
    });

    const result = await loadActiveCommentUsers();

    expect(mockFrom).toHaveBeenCalledWith('projects');
    expect(mockFrom).toHaveBeenCalledWith('project_members');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(result.map((u) => u.id).sort()).toEqual(['u-2', 'u-3']);
  });

  it('filters mentionable users to project owner and members for a specific work item', async () => {
    const workItemId = 'wi-100';
    const projectId = 'proj-99';
    const ownerId = 'user-owner';
    const memberId = 'user-member';
    const adminId = 'user-admin';
    const nonMemberId = 'user-other';

    mockFrom.mockImplementation((table: string) => {
      if (table === 'work_items') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { project_id: projectId } }),
            }),
          }),
        };
      }
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { owner_id: ownerId } }),
            }),
          }),
        };
      }
      if (table === 'project_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [{ user_id: memberId }],
              }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'status' && value === 'active') {
                return {
                  in: (_id: string, ids: string[]) => {
                    const matched = [];
                    if (ids.includes(ownerId)) {
                      matched.push({
                        id: ownerId,
                        name: 'Owen Owner',
                        email: 'owner@dev.com',
                        role: 'member',
                      });
                    }
                    if (ids.includes(memberId)) {
                      matched.push({
                        id: memberId,
                        name: 'Mona Member',
                        email: 'member@dev.com',
                        role: 'member',
                      });
                    }
                    if (ids.includes(adminId)) {
                      matched.push({
                        id: adminId,
                        name: 'Alice Admin',
                        email: 'admin@dev.com',
                        role: 'admin',
                      });
                    }
                    return Promise.resolve({ data: matched });
                  },
                };
              }
              return Promise.resolve({ data: [] });
            },
          }),
        };
      }
      return {};
    });

    const result = await loadActiveCommentUsers(workItemId);

    const resultIds = result.map((u) => u.id);
    expect(resultIds).toContain(ownerId);
    expect(resultIds).toContain(memberId);
    expect(resultIds).not.toContain(adminId);
    expect(resultIds).not.toContain(nonMemberId);
  });
});
