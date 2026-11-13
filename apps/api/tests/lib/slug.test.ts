import { describe, expect, it } from 'vitest';
import { allocateUniqueSlug, slugifyTitle } from '@repo/types';

describe('slugifyTitle', () => {
  it('lowercases and kebab-cases titles', () => {
    expect(slugifyTitle('Fix Login Bug')).toBe('fix-login-bug');
  });

  it('strips punctuation and collapses dashes', () => {
    expect(slugifyTitle('  Hello, World!!!  ')).toBe('hello-world');
  });

  it('falls back for empty input', () => {
    expect(slugifyTitle('---')).toBe('item');
    expect(slugifyTitle('')).toBe('item');
  });
});

describe('allocateUniqueSlug', () => {
  it('returns the base when free', () => {
    expect(allocateUniqueSlug('Sprint 1', new Set())).toBe('sprint-1');
  });

  it('appends -2, -3 on collision', () => {
    const taken = new Set(['sprint-1', 'sprint-1-2']);
    expect(allocateUniqueSlug('Sprint 1', taken)).toBe('sprint-1-3');
  });
});
