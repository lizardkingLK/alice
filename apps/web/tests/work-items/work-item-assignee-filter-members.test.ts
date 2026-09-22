import { describe, expect, it } from 'vitest';
import type { ProjectMembersByProjectId } from '@/app/projects/_services/projects.mutations.shared';
import {
  resolveAssigneeFilterMembers,
  unionProjectMembers,
} from '@/app/work-items/_helpers/work-item-assignee-filter-members';

const membersByProjectId: ProjectMembersByProjectId = {
  'proj-1': [
    {
      project_id: 'proj-1',
      user_id: 'u1',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      user: {
        id: 'u1',
        name: 'Ada',
        email: 'ada@alice.dev',
        role: 'member',
        profile_picture: null,
      },
    },
    {
      project_id: 'proj-1',
      user_id: 'u2',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      user: {
        id: 'u2',
        name: 'Bob',
        email: 'bob@alice.dev',
        role: 'manager',
        profile_picture: null,
      },
    },
  ],
  'proj-2': [
    {
      project_id: 'proj-2',
      user_id: 'u2',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      user: {
        id: 'u2',
        name: 'Bob',
        email: 'bob@alice.dev',
        role: 'manager',
        profile_picture: null,
      },
    },
    {
      project_id: 'proj-2',
      user_id: 'u3',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      user: {
        id: 'u3',
        name: 'Cara',
        email: 'cara@alice.dev',
        role: 'member',
        profile_picture: null,
      },
    },
  ],
};

describe('unionProjectMembers', () => {
  it('dedupes members across projects', () => {
    expect(unionProjectMembers(membersByProjectId).map((m) => m.id)).toEqual([
      'u1',
      'u2',
      'u3',
    ]);
  });
});

describe('resolveAssigneeFilterMembers', () => {
  it('returns members of the selected project', () => {
    expect(
      resolveAssigneeFilterMembers({
        membersByProjectId,
        projectId: 'proj-1',
      }).map((m) => m.id)
    ).toEqual(['u1', 'u2']);
  });

  it('returns the union when no project filter is set', () => {
    expect(
      resolveAssigneeFilterMembers({
        membersByProjectId,
        projectId: 'all',
      }).map((m) => m.id)
    ).toEqual(['u1', 'u2', 'u3']);
  });
});
