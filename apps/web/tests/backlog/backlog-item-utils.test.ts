import { describe, expect, it } from 'vitest';
import { filterBacklogDisplayedSprints } from '@/app/backlog/_helpers/backlog-item-utils';
import { mergeWorkItemServerRow } from '@/app/work-items/_helpers/work-item-merge-server-row';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

function baseItem(overrides: Partial<DbWorkItem> = {}): DbWorkItem {
  return {
    id: 'wi-1',
    project_id: 'proj-1',
    sprint_id: null,
    parent_id: null,
    title: 'Sample',
    description: null,
    type: 'task',
    priority: 'medium',
    labels: [],
    assignee_id: 'user-1',
    reporter_id: null,
    due_date: null,
    story_points: null,
    status: 'todo',
    record_status: 'active',
    done_at: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_by: null,
    updated_at: '2026-09-01T00:00:00.000Z',
    jira_issue_key: null,
    assignee: {
      id: 'user-1',
      name: 'Ada',
      email: 'ada@alice.dev',
      profile_picture: 'https://cdn.example/ada.png',
    },
    reporter: null,
    ...overrides,
  } as DbWorkItem;
}

describe('mergeWorkItemServerRow', () => {
  it('refreshes updated_at and domain fields from the server row', () => {
    const current = baseItem({ story_points: null, sprint_id: null });
    const updated = baseItem({
      story_points: 6,
      sprint_id: 'sprint-2',
      updated_at: '2026-09-11T12:00:00.000Z',
      assignee: {
        id: 'user-1',
        name: 'Ada',
        email: 'ada@alice.dev',
        profile_picture: null,
      },
    });

    const merged = mergeWorkItemServerRow(current, updated);

    expect(merged.updated_at).toBe('2026-09-11T12:00:00.000Z');
    expect(merged.story_points).toBe(6);
    expect(merged.sprint_id).toBe('sprint-2');
  });

  it('keeps the local assignee embed when the server omits it', () => {
    const current = baseItem();
    const updated = baseItem({
      updated_at: '2026-09-11T12:00:00.000Z',
      assignee: null,
    });

    const merged = mergeWorkItemServerRow(current, updated);

    expect(merged.assignee?.profile_picture).toBe(
      'https://cdn.example/ada.png'
    );
    expect(merged.updated_at).toBe('2026-09-11T12:00:00.000Z');
  });
});

describe('filterBacklogDisplayedSprints', () => {
  const sprints = [
    { id: 's1', status: 'active', projectId: 'proj-1' },
    { id: 's2', status: 'planned', projectId: 'proj-1' },
    { id: 's3', status: 'closed', projectId: 'proj-1' },
    { id: 's4', status: 'active', projectId: 'proj-2' },
  ];

  const filter = (options: {
    activeTab: 'active' | 'completed';
    projectFilter: string;
    sprintFilter: string;
  }) =>
    filterBacklogDisplayedSprints({
      sprints,
      ...options,
      getStatus: (sprint) => sprint.status,
      getProjectId: (sprint) => sprint.projectId,
    }).map((sprint) => sprint.id);

  it('lists active and planned sprints for a project when no sprint default', () => {
    expect(
      filter({
        activeTab: 'active',
        projectFilter: 'proj-1',
        sprintFilter: '',
      })
    ).toEqual(['s1', 's2']);
  });

  it('narrows to the selected default sprint only', () => {
    expect(
      filter({
        activeTab: 'active',
        projectFilter: 'proj-1',
        sprintFilter: 's1',
      })
    ).toEqual(['s1']);
  });

  it('keeps completed-tab filtering when a sprint default is set', () => {
    expect(
      filter({
        activeTab: 'completed',
        projectFilter: 'proj-1',
        sprintFilter: 's3',
      })
    ).toEqual(['s3']);
    expect(
      filter({
        activeTab: 'completed',
        projectFilter: 'proj-1',
        sprintFilter: 's1',
      })
    ).toEqual([]);
  });
});
