import type { Sprint } from '@/app/sprints/_services/sprints.service';

export function formatDateToISOString(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): string {
  return new Date(
    Date.UTC(year, month, day, hour, minute, second)
  ).toISOString();
}

export const sprintFactory = {
  build(overrides: Partial<Sprint> = {}): Sprint {
    return {
      id: 'sprint-123',
      name: 'Sprint 1',
      goal: 'Achieve project milestone',
      status: 'planned',
      startDate: '2026-07-10',
      endDate: '2026-07-24',
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: formatDateToISOString(2026, 6, 9, 10, 0, 0),
      updatedAt: formatDateToISOString(2026, 6, 9, 10, 0, 0),
      project: {
        id: 'proj-1',
        name: 'Project Alpha',
        key: 'PAL',
      },
      ...overrides,
    };
  },

  buildList(count: number, overrides: Partial<Sprint> = {}): Sprint[] {
    return Array.from({ length: count }, (_, index) =>
      sprintFactory.build({
        id: `sprint-${index + 1}`,
        name: `Sprint ${index + 1}`,
        ...overrides,
      })
    );
  },
};
