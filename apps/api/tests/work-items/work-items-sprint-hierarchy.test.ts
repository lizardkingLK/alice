import { describe, expect, it } from 'vitest';
import { assertChildSprintMatchesParent } from '../../src/routes/api/work-items/work-items-sprint-hierarchy.js';
import { WorkItemValidationError } from '../../src/routes/api/work-items/work-items.errors.js';

describe('assertChildSprintMatchesParent', () => {
  it('allows matching sprint ids', () => {
    expect(() =>
      assertChildSprintMatchesParent('sprint-a', 'sprint-a')
    ).not.toThrow();
    expect(() => assertChildSprintMatchesParent(null, null)).not.toThrow();
  });

  it('rejects sprint mismatch', () => {
    expect(() =>
      assertChildSprintMatchesParent('sprint-a', 'sprint-b')
    ).toThrow(WorkItemValidationError);
    expect(() => assertChildSprintMatchesParent(null, 'sprint-a')).toThrow(
      WorkItemValidationError
    );
  });
});
