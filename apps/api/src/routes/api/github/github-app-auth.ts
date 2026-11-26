import { createSign } from 'node:crypto';
import { env } from '../../../config/env';
import type {
  GithubAppMetadataResponse,
  GithubInstallationAccessTokenResponse,
  GithubInstallationResponse,
} from './github.types';

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Alice-App',
  'X-GitHub-Api-Version': '2022-11-28',
} as const;

/** Max JWT lifetime GitHub allows (10 minutes). */
const APP_JWT_TTL_SEC = 10 * 60;
/** Clock-skew cushion when setting `iat`. */
const APP_JWT_IAT_SKEW_SEC = 60;

export type GithubAppConfig = {
  appId: string;
  privateKey: string;
  webhookSecret?: string;
};

export function requireGithubAppConfig(): GithubAppConfig {
  const appId = env.GITHUB_APP_ID;
  const privateKeyRaw = env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKeyRaw) {
    throw new Error(
      'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.'
    );
  }

  return {
    appId,
    privateKey: normalizeGithubAppPrivateKey(privateKeyRaw),
    webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
  };
}

/** Turn single-line `.env` PEMs (`\\n`) into multiline PKCS#1 / PKCS#8 text. */
export function normalizeGithubAppPrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes(String.raw`\n`) && !trimmed.includes('\n')) {
    return trimmed.replaceAll(String.raw`\n`, '\n');
  }
  return trimmed;
}

/**
 * RS256 JWT for GitHub App authentication (`iss` = numeric App ID).
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */
export function createGithubAppJwt(
  appId: string,
  privateKeyPem: string,
  nowSec = Math.floor(Date.now() / 1000)
): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: nowSec - APP_JWT_IAT_SKEW_SEC,
    exp: nowSec + APP_JWT_TTL_SEC,
    iss: appId,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url'
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKeyPem, 'base64url');

  return `${signingInput}.${signature}`;
}

async function githubAppFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const { appId, privateKey } = requireGithubAppConfig();
  const jwt = createGithubAppJwt(appId, privateKey);
  return fetch(`${GITHUB_API_URL}${path}`, {
    ...init,
    headers: {
      ...GITHUB_API_HEADERS,
      Authorization: `Bearer ${jwt}`,
      ...init?.headers,
    },
  });
}

async function readGithubAppJson<T>(
  response: Response,
  failureLabel: string
): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${failureLabel} (${response.status}): ${errorText}`);
  }
  return (await response.json()) as T;
}

export async function fetchGithubAppMetadata(): Promise<GithubAppMetadataResponse> {
  const response = await githubAppFetch('/app');
  return readGithubAppJson<GithubAppMetadataResponse>(
    response,
    'Failed to fetch GitHub App metadata'
  );
}

export async function fetchGithubInstallation(
  installationId: number
): Promise<GithubInstallationResponse> {
  const response = await githubAppFetch(`/app/installations/${installationId}`);
  return readGithubAppJson<GithubInstallationResponse>(
    response,
    `Failed to fetch GitHub App installation ${installationId}`
  );
}

export async function createInstallationAccessToken(
  installationId: number
): Promise<GithubInstallationAccessTokenResponse> {
  const response = await githubAppFetch(
    `/app/installations/${installationId}/access_tokens`,
    { method: 'POST' }
  );
  return readGithubAppJson<GithubInstallationAccessTokenResponse>(
    response,
    'Failed to mint GitHub installation token'
  );
}
