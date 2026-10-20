import { describe, expect, it } from 'vitest';
import { parseBacklogWorkspaceBundle } from '@/app/backlog/_helpers/backlog-workspace-bundle';

describe('parseBacklogWorkspaceBundle', () => {
  it('returns null for non-object payloads', () => {
    expect(parseBacklogWorkspaceBundle(null)).toBeNull();
    expect(parseBacklogWorkspaceBundle([])).toBeNull();
    expect(parseBacklogWorkspaceBundle('nope')).toBeNull();
  });

  it('parses work items, sprints, and team capacities', () => {
    const result = parseBacklogWorkspaceBundle({
      work_items: [
        {
          id: 'wi-1',
          title: 'Story',
          project_id: 'proj-1',
          assignee_id: 'user-1',
        },
      ],
      sprints: [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          project_id: 'proj-1',
          status: 'active',
          start_date: '2026-01-01',
          end_date: '2026-01-14',
          created_by: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          project: { id: 'proj-1', key: 'P1', name: 'Project 1' },
        },
      ],
      team_capacities: [
        {
          projectId: 'proj-1',
          userId: 'user-1',
          capacity: 40,
          allocation: 100,
        },
        { projectId: null, userId: 'user-2', capacity: 20, allocation: 50 },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.workItems).toHaveLength(1);
    expect(result!.workItems[0]).toMatchObject({
      id: 'wi-1',
      assignee: null,
      reporter: null,
    });
    expect(result!.sprintRows).toHaveLength(1);
    expect(result!.sprintRows[0]?.id).toBe('sprint-1');
    expect(result!.teamCapacities).toEqual([
      {
        projectId: 'proj-1',
        userId: 'user-1',
        capacity: 40,
        allocation: 100,
      },
    ]);
  });

  it('defaults missing arrays to empty', () => {
    const result = parseBacklogWorkspaceBundle({});
    expect(result).toEqual({
      workItems: [],
      sprintRows: [],
      teamCapacities: [],
    });
  });
});
