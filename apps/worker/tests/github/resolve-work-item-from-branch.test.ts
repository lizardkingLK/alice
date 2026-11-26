import { describe, expect, it } from 'vitest';
import { extractWorkItemCandidates } from '../../src/jobs/github/resolve-work-item-from-branch';

describe('extractWorkItemCandidates', () => {
  it('extracts KEY-slug and KEY/slug from branch names', () => {
    expect(
      extractWorkItemCandidates('ALICE', 'feature/ALICE-fix-login')
    ).toEqual({
      slugs: ['fix-login'],
      ids: [],
    });

    expect(extractWorkItemCandidates('ALICE', 'ALICE/add-oauth')).toEqual({
      slugs: ['add-oauth'],
      ids: [],
    });
  });

  it('extracts a work-item UUID from the branch', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(extractWorkItemCandidates('ALICE', `chore/${id}-tweaks`)).toEqual({
      slugs: [],
      ids: [id],
    });
  });

  it('also scans the PR title', () => {
    expect(
      extractWorkItemCandidates(
        'ALICE',
        'random-branch',
        '[ALICE-board-filter] WIP'
      )
    ).toEqual({
      slugs: ['board-filter'],
      ids: [],
    });
  });
});
