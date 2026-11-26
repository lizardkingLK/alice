import {
  decryptSecret,
  encryptSecret,
} from '../../../lib/secrets/token-crypto';
import type {
  FigmaAuthorizationTokenResponse,
  FigmaRefreshTokenResponse,
} from './figma-token-client';

export const FIGMA_RECOVERY_ENVELOPE_KEY_VERSION = 1;

export type FigmaRecoveryEnvelope = {
  kind: 'authorization_code_exchange' | 'token_refresh';
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  figmaUserId: string | null;
};

export function encryptAuthorizationEnvelope(
  response: FigmaAuthorizationTokenResponse
): string {
  return encryptSecret(
    JSON.stringify({
      kind: 'authorization_code_exchange',
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresIn: response.expires_in,
      figmaUserId: response.user_id_string,
    } satisfies FigmaRecoveryEnvelope)
  );
}

export function encryptRefreshEnvelope(
  response: FigmaRefreshTokenResponse
): string {
  return encryptSecret(
    JSON.stringify({
      kind: 'token_refresh',
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? null,
      expiresIn: response.expires_in,
      figmaUserId: null,
    } satisfies FigmaRecoveryEnvelope)
  );
}

export function decryptRecoveryEnvelope(
  encrypted: string,
  expectedKind: FigmaRecoveryEnvelope['kind']
): FigmaRecoveryEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(decryptSecret(encrypted));
  } catch {
    throw new Error('The encrypted Figma recovery envelope is invalid.');
  }
  if (!value || typeof value !== 'object') {
    throw new Error('The encrypted Figma recovery envelope is invalid.');
  }
  const envelope = value as Partial<FigmaRecoveryEnvelope>;
  if (
    envelope.kind !== expectedKind ||
    typeof envelope.accessToken !== 'string' ||
    !envelope.accessToken ||
    (envelope.refreshToken !== null &&
      typeof envelope.refreshToken !== 'string') ||
    typeof envelope.expiresIn !== 'number' ||
    !Number.isInteger(envelope.expiresIn) ||
    envelope.expiresIn <= 0 ||
    (envelope.figmaUserId !== null && typeof envelope.figmaUserId !== 'string')
  ) {
    throw new Error('The encrypted Figma recovery envelope is invalid.');
  }
  return envelope as FigmaRecoveryEnvelope;
}
