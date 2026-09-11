import { describe, expect, it } from 'vitest';
import { resolveBoardColumnPatchValue } from '../../src/routes/api/workItems/workItems.patch-utils';

describe('resolveBoardColumnPatchValue', () => {
  it('preserves placement for unrelated omitted patches', () => {
    expect(
      resolveBoardColumnPatchValue({
        wasProvided: false,
        value: undefined,
        currentValue: 'code-review',
        workflowContextChanged: false,
      })
    ).toBe('code-review');
  });

  it('clears omitted placement when status or project changes', () => {
    expect(
      resolveBoardColumnPatchValue({
        wasProvided: false,
        value: undefined,
        currentValue: 'code-review',
        workflowContextChanged: true,
      })
    ).toBeNull();
  });

  it('distinguishes explicit null from a provided column ID', () => {
    const base = {
      wasProvided: true,
      currentValue: 'development',
      workflowContextChanged: false,
    } as const;

    expect(resolveBoardColumnPatchValue({ ...base, value: null })).toBeNull();
    expect(
      resolveBoardColumnPatchValue({ ...base, value: 'code-review' })
    ).toBe('code-review');
  });
});
