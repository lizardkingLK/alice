import { describe, expect, it } from 'vitest';
import { filterProjectsByAccessibleIds } from '@/lib/projects/accessible-project-list';

describe('filterProjectsByAccessibleIds', () => {
  it('keeps only projects in the accessible id set', () => {
    const projects = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];

    expect(filterProjectsByAccessibleIds(projects, ['b', 'c'])).toEqual([
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
  });

  it('returns an empty list when there are no accessible ids', () => {
    expect(filterProjectsByAccessibleIds([{ id: 'a', name: 'A' }], [])).toEqual(
      []
    );
  });
});
