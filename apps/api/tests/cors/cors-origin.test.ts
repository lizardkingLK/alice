import { describe, expect, it } from 'vitest';
import { isAllowedCorsOrigin } from '../../src/config/cors';

describe('isAllowedCorsOrigin', () => {
  it('allows missing origin (non-browser clients)', () => {
    expect(isAllowedCorsOrigin(undefined)).toBe(true);
  });

  it('allows 127.0.0.1 when FRONTEND_URL is localhost', () => {
    expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(true);
  });
});
