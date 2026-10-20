import { describe, expect, it } from 'vitest';
import { parseProjectWorkspaceBundle } from '@/app/projects/_helpers/project-workspace-bundle';

describe('parseProjectWorkspaceBundle', () => {
  it('returns null for non-object or missing project id', () => {
    expect(parseProjectWorkspaceBundle(null)).toBeNull();
    expect(parseProjectWorkspaceBundle({})).toBeNull();
    expect(parseProjectWorkspaceBundle({ project: { name: 'x' } })).toBeNull();
  });

  it('parses project, members, and badge counts', () => {
    const result = parseProjectWorkspaceBundle({
      project: {
        id: 'proj-1',
        key: 'P1',
        name: 'Project',
        has_github_token: false,
      },
      members: [
        {
          project_id: 'proj-1',
          user_id: 'user-1',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          user: {
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'member',
          },
        },
        { project_id: 'proj-1', user_id: 'bad' },
      ],
      work_item_total: 12,
      team_total: 3,
      sprint_total: 2,
    });

    expect(result).not.toBeNull();
    expect(result!.project.id).toBe('proj-1');
    expect(result!.members).toHaveLength(1);
    expect(result!.workItemTotal).toBe(12);
    expect(result!.teamTotal).toBe(3);
    expect(result!.sprintTotal).toBe(2);
  });
});
