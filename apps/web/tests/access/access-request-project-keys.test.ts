import { describe, expect, it } from 'vitest';
import {
  accessRequestProjectKeysFromValue,
  parseRequestedProjectKeysInput,
} from '@repo/types';

describe('parseRequestedProjectKeysInput', () => {
  it('normalizes comma and whitespace separated keys', () => {
    expect(parseRequestedProjectKeysInput('acme, beta  gamma;delta')).toEqual([
      'ACME',
      'BETA',
      'GAMMA',
      'DELTA',
    ]);
  });

  it('accepts string arrays and drops empties', () => {
    expect(parseRequestedProjectKeysInput([' acme ', '', 'BETA'])).toEqual([
      'ACME',
      'BETA',
    ]);
  });

  it('returns an empty list for blank input', () => {
    expect(parseRequestedProjectKeysInput(undefined)).toEqual([]);
    expect(parseRequestedProjectKeysInput('  , ; ')).toEqual([]);
  });
});

describe('accessRequestProjectKeysFromValue', () => {
  it('reads JSON array values from access_requests rows', () => {
    expect(accessRequestProjectKeysFromValue(['acme', 'BETA'])).toEqual([
      'ACME',
      'BETA',
    ]);
  });
});
