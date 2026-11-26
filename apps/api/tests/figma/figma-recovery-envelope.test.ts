import { describe, expect, it } from 'vitest';
import {
  decryptRecoveryEnvelope,
  encryptAuthorizationEnvelope,
  encryptRefreshEnvelope,
} from '../../src/routes/api/figma/figma-recovery-envelope';

describe('Figma recovery envelopes', () => {
  it('encrypts authorization tokens and round-trips the validated payload', () => {
    const encrypted = encryptAuthorizationEnvelope({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      expires_in: 3600,
      token_type: 'bearer',
      user_id_string: 'figma-user-1',
    });

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain('access-secret');
    expect(encrypted).not.toContain('refresh-secret');
    expect(
      decryptRecoveryEnvelope(encrypted, 'authorization_code_exchange')
    ).toMatchObject({
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      figmaUserId: 'figma-user-1',
    });
  });

  it('rejects using a refresh envelope as an authorization envelope', () => {
    const encrypted = encryptRefreshEnvelope({
      access_token: 'access-secret',
      expires_in: 3600,
      token_type: 'bearer',
    });

    expect(() =>
      decryptRecoveryEnvelope(encrypted, 'authorization_code_exchange')
    ).toThrow('recovery envelope is invalid');
  });
});
