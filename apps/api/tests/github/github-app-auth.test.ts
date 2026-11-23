import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createGithubAppJwt,
  normalizeGithubAppPrivateKey,
} from '../../src/routes/api/github/github-app-auth';

describe('github-app-auth', () => {
  it('normalizes single-line env PEMs that use escaped newlines', () => {
    const normalized = normalizeGithubAppPrivateKey(
      '-----BEGIN RSA PRIVATE KEY-----\\nABC\\n-----END RSA PRIVATE KEY-----'
    );

    expect(normalized).toBe(
      '-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----'
    );
  });

  it('creates a verifiable RS256 App JWT with iss/iat/exp claims', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const privatePem = privateKey
      .export({ type: 'pkcs1', format: 'pem' })
      .toString();
    const publicPem = publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const nowSec = 1_700_000_000;

    const jwt = createGithubAppJwt('4242', privatePem, nowSec);
    const [headerB64, payloadB64, signatureB64] = jwt.split('.');
    expect(headerB64).toBeTruthy();
    expect(payloadB64).toBeTruthy();
    expect(signatureB64).toBeTruthy();

    const header = JSON.parse(
      Buffer.from(headerB64!, 'base64url').toString('utf8')
    ) as { alg: string; typ: string };
    const payload = JSON.parse(
      Buffer.from(payloadB64!, 'base64url').toString('utf8')
    ) as { iss: string; iat: number; exp: number };

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(payload.iss).toBe('4242');
    expect(payload.iat).toBe(nowSec - 60);
    expect(payload.exp).toBe(nowSec + 10 * 60);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    expect(
      verifier.verify(publicPem, Buffer.from(signatureB64!, 'base64url'))
    ).toBe(true);
  });
});
