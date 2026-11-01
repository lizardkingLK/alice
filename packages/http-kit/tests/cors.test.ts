import { describe, expect, it } from 'vitest';
import { createCorsConfig } from '../src/cors';

describe('createCorsConfig', () => {
  it('allows missing origin (non-browser clients)', () => {
    const { isAllowedCorsOrigin } = createCorsConfig({
      frontendUrl: 'http://localhost:3000',
    });
    expect(isAllowedCorsOrigin(undefined)).toBe(true);
  });

  it('allows 127.0.0.1 when FRONTEND_URL is localhost', () => {
    const { isAllowedCorsOrigin } = createCorsConfig({
      frontendUrl: 'http://localhost:3000',
    });
    expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(true);
  });
});
