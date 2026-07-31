import { describe, it, expect } from 'vitest';
import { sortSubtasks } from '@/app/work-items/_helpers/sort-subtasks';
import { workItemFactory } from '../factories/workItem.factory';

describe('sortSubtasks', () => {
  const alpha = workItemFactory.build({
    id: 'wi-a',
    title: 'Alpha task',
    priority: 'low',
    assignee: { id: 'u1', name: 'Zed', email: 'z@x.com' },
  });
  const beta = workItemFactory.build({
    id: 'wi-b',
    title: 'Beta task',
    priority: 'highest',
    assignee: { id: 'u2', name: 'Ann', email: 'a@x.com' },
  });
  const gamma = workItemFactory.build({
    id: 'wi-c',
    title: 'Gamma task',
    priority: 'medium',
    assignee: null,
    assignee_id: null,
  });

  it('keeps original order when sort field is none', () => {
    expect(
      sortSubtasks([beta, alpha, gamma], 'none', 'asc').map((i) => i.id)
    ).toEqual(['wi-b', 'wi-a', 'wi-c']);
  });

  it('sorts by title A–Z and Z–A', () => {
    expect(
      sortSubtasks([beta, alpha, gamma], 'title', 'asc').map((i) => i.title)
    ).toEqual(['Alpha task', 'Beta task', 'Gamma task']);
    expect(
      sortSubtasks([beta, alpha, gamma], 'title', 'desc').map((i) => i.title)
    ).toEqual(['Gamma task', 'Beta task', 'Alpha task']);
  });

  it('sorts by priority lowest→highest for A–Z', () => {
    expect(
      sortSubtasks([beta, alpha, gamma], 'priority', 'asc').map(
        (i) => i.priority
      )
    ).toEqual(['low', 'medium', 'highest']);
  });

  it('sorts by assignee name and puts unassigned last for A–Z', () => {
    expect(
      sortSubtasks([alpha, beta, gamma], 'assignee', 'asc').map(
        (i) => i.assignee?.name ?? null
      )
    ).toEqual(['Ann', 'Zed', null]);
  });
});
