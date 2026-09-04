import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectMembersTab } from '@/app/projects/[id]/_components/project-members-tab';
import type {
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_services/projects.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import { UserRole } from '@repo/types';

vi.mock('@/app/projects/[id]/_components/actions', () => ({
  addMemberAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));

const baseProject = {
  id: 'project-1',
  name: 'Alice',
  key: 'ALICE',
  description: null,
  status: 'active',
  start_date: null,
  end_date: null,
  owner_id: 'user-manager',
  created_by: 'user-admin',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  updated_by: null,
  jira_project_key: null,
  jira_connection_id: null,
  github_repo: null,
  logo_url: null,
  cover_picture: null,
  attributes_config: null,
  workflow_config: null,
} as unknown as Project;

function member(
  userId: string,
  name: string,
  role: UserRole
): ProjectMemberWithUser {
  return {
    project_id: 'project-1',
    user_id: userId,
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    user: {
      id: userId,
      name,
      email: `${userId}@example.com`,
      role,
    },
  };
}

describe('ProjectMembersTab protected members', () => {
  const allUsers: User[] = [];

  it('disables remove for owner and creator', () => {
    render(
      <ProjectMembersTab
        project={baseProject}
        members={[
          member('user-manager', 'Manager Owner', 'manager'),
          member('user-admin', 'Admin Creator', 'admin'),
          member('user-member', 'Member', 'member'),
        ]}
        allUsers={allUsers}
        currentUserId="user-manager"
        currentUserRole="manager"
      />
    );

    expect(
      screen.getByTitle(
        'Cannot remove the project owner. Change the owner on the project first.'
      )
    ).toBeDisabled();
    expect(
      screen.getByTitle(
        'Cannot remove the project creator. The admin who created this project stays assigned.'
      )
    ).toBeDisabled();
    expect(screen.getByTitle('Remove Member')).not.toBeDisabled();
  });
});
