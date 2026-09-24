import { describe, it, expect } from 'vitest';
import {
  filterDialogOptionsBySearch,
  groupFilterDialogOptions,
  type FilterDialogOption,
} from '@/components/filter-dialog-shell';

const SPRINT_OPTIONS: FilterDialogOption[] = [
  {
    value: 's1',
    label: 'Sprint 1',
    groupId: 'p1',
    groupLabel: 'Alice Platform',
  },
  {
    value: 's2',
    label: 'Sprint 2',
    groupId: 'p1',
    groupLabel: 'Alice Platform',
  },
  {
    value: 's3',
    label: 'Sprint 1',
    groupId: 'p2',
    groupLabel: 'EasyPass',
  },
];

describe('filterDialogOptionsBySearch', () => {
  it('returns all options when search is empty', () => {
    expect(filterDialogOptionsBySearch(SPRINT_OPTIONS, '')).toEqual(
      SPRINT_OPTIONS
    );
  });

  it('keeps options whose label matches', () => {
    expect(filterDialogOptionsBySearch(SPRINT_OPTIONS, 'Sprint 2')).toEqual([
      SPRINT_OPTIONS[1],
    ]);
  });

  it('keeps the whole group when the project label matches', () => {
    expect(filterDialogOptionsBySearch(SPRINT_OPTIONS, 'alice')).toEqual([
      SPRINT_OPTIONS[0],
      SPRINT_OPTIONS[1],
    ]);
  });
});

describe('groupFilterDialogOptions', () => {
  it('groups options by project in first-seen order', () => {
    expect(groupFilterDialogOptions(SPRINT_OPTIONS)).toEqual([
      {
        id: 'p1',
        label: 'Alice Platform',
        options: [SPRINT_OPTIONS[0], SPRINT_OPTIONS[1]],
      },
      {
        id: 'p2',
        label: 'EasyPass',
        options: [SPRINT_OPTIONS[2]],
      },
    ]);
  });

  it('collects options without a group into Other', () => {
    expect(
      groupFilterDialogOptions([
        { value: 'a', label: 'A' },
        {
          value: 'b',
          label: 'B',
          groupId: 'p1',
          groupLabel: 'Project',
        },
        { value: 'c', label: 'C' },
      ])
    ).toEqual([
      {
        id: 'p1',
        label: 'Project',
        options: [
          {
            value: 'b',
            label: 'B',
            groupId: 'p1',
            groupLabel: 'Project',
          },
        ],
      },
      {
        id: '__ungrouped__',
        label: 'Other',
        options: [
          { value: 'a', label: 'A' },
          { value: 'c', label: 'C' },
        ],
      },
    ]);
  });
});
