import { describe, expect, it } from 'vitest';
import {
  signGithubWebhookBody,
  verifyGithubWebhookSignature,
} from '../../src/routes/api/github/github-webhook-signature';

describe('github-webhook-signature', () => {
  const secret = 'test-webhook-secret';
  const body = Buffer.from('{"zen":"Keep it logically awesome."}', 'utf8');

  it('accepts a valid sha256 signature', () => {
    const signature = signGithubWebhookBody(body, secret);
    expect(verifyGithubWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    const signature = signGithubWebhookBody(body, secret);
    expect(verifyGithubWebhookSignature(body, signature, 'other')).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyGithubWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyGithubWebhookSignature(body, 'sha1=abc', secret)).toBe(false);
    expect(verifyGithubWebhookSignature(body, 'sha256=zz', secret)).toBe(false);
  });

  it('rejects a tampered body', () => {
    const signature = signGithubWebhookBody(body, secret);
    const tampered = Buffer.from('{"zen":"nope"}', 'utf8');
    expect(verifyGithubWebhookSignature(tampered, signature, secret)).toBe(
      false
    );
  });
});
