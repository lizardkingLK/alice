import { describe, expect, it } from 'vitest';
import {
  isMissingRelationError,
  isMissingRpcError,
  isUnsatisfiableRangeError,
} from '@/lib/db/query';

describe('PostgREST error helpers', () => {
  it('detects missing RPC (PGRST202 / function not in schema cache)', () => {
    expect(isMissingRpcError({ code: 'PGRST202', message: '…' })).toBe(true);
    expect(
      isMissingRpcError({
        message:
          'Could not find the function public.get_backlog_workspace_bundle(uuid[]) in the schema cache',
      })
    ).toBe(true);
    expect(isMissingRpcError({ code: 'PGRST205', message: 'table' })).toBe(
      false
    );
  });

  it('detects missing relation (PGRST205)', () => {
    expect(isMissingRelationError({ code: 'PGRST205' })).toBe(true);
    expect(
      isMissingRelationError({
        message: 'Could not find the table in schema cache',
      })
    ).toBe(true);
  });

  it('detects unsatisfiable range (PGRST103)', () => {
    expect(isUnsatisfiableRangeError({ code: 'PGRST103' })).toBe(true);
    expect(
      isUnsatisfiableRangeError({
        message: 'Requested range not satisfiable',
      })
    ).toBe(true);
  });
});
