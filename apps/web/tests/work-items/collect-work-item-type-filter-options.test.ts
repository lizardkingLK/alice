import { describe, expect, it } from 'vitest';
import { buildDefaultProjectTypeDefs } from '@repo/types';
import { collectWorkItemTypeFilterOptions } from '@/app/work-items/_helpers/collect-work-item-type-filter-options';

describe('collectWorkItemTypeFilterOptions', () => {
  it('uses catalog display names from project workflow config', () => {
    const customKey = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const options = collectWorkItemTypeFilterOptions({
      projects: [
        {
          id: 'proj-1',
          workflow_config: {
            work_item_types: [
              ...buildDefaultProjectTypeDefs(['Epic', 'Task']),
              {
                key: customKey,
                name: 'Initiative',
                icon: 'trophy',
                level: 2,
              },
            ],
          },
        },
      ],
      projectId: 'proj-1',
    });

    expect(options).toEqual(
      expect.arrayContaining([
        { value: 'Epic', label: 'Epic' },
        { value: 'Task', label: 'Task' },
        { value: customKey, label: 'Initiative' },
      ])
    );
    expect(options.find((option) => option.value === customKey)?.label).toBe(
      'Initiative'
    );
  });

  it('falls back to seed keys when no catalog is available', () => {
    const options = collectWorkItemTypeFilterOptions({ projects: [] });
    expect(options.map((option) => option.value)).toEqual([
      'Epic',
      'Feature',
      'Issue',
      'Story',
      'Task',
    ]);
  });
});
