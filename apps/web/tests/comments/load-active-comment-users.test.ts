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

  it('fetches active admins, project owners, and members when workItemId is undefined or all', async () => {
    const mockAdmin = {
      id: 'u-1',
      name: 'Alice Admin',
      email: 'admin@dev.com',
      role: 'admin',
    };
    const mockOwner = {
      id: 'u-2',
      name: 'Owen Owner',
      email: 'owner@dev.com',
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
            eq: async () => ({ data: [] }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: (field: string, val: string) => {
              if (field === 'status' && val === 'active') {
                return {
                  eq: () => Promise.resolve({ data: [mockAdmin] }),
                  in: () => Promise.resolve({ data: [mockOwner] }),
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
    expect(result).toEqual([mockAdmin, mockOwner]);
  });

  it('filters mentionable users to admin, project owner, and project members for a specific work item', async () => {
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
                  eq: (roleField: string, roleValue: string) => {
                    if (roleField === 'role' && roleValue === 'admin') {
                      return Promise.resolve({
                        data: [
                          {
                            id: adminId,
                            name: 'Alice Admin',
                            email: 'admin@dev.com',
                            role: 'admin',
                          },
                        ],
                      });
                    }
                    return Promise.resolve({ data: [] });
                  },
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
    expect(resultIds).toContain(adminId);
    expect(resultIds).toContain(ownerId);
    expect(resultIds).toContain(memberId);
    expect(resultIds).not.toContain(nonMemberId);
  });
});
