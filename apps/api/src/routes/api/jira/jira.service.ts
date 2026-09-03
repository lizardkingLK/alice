import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mapToWorkItemType, UserRoleEnum } from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import { env } from '../../../config/env';
import {
  decryptSecret,
  encryptSecret,
  resolveIntegrationEncryptionKey,
} from '../../../lib/secrets/token-crypto';
import type { JiraRepository } from './jira.repository';
import type {
  AtlassianAccessibleResource,
  AtlassianTokenResponse,
  JiraCloudProject,
  JiraConnectionDto,
  JiraConnectionRow,
  JiraNode,
  JiraSearchResponse,
  ParsedJiraIssue,
} from './jira.types';

const OAUTH_SCOPES = 'read:jira-work read:jira-user offline_access';
const STATE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_SKEW_MS = 60 * 1000;

type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
};

function requireAtlassianConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = env.ATLASSIAN_CLIENT_ID;
  const clientSecret = env.ATLASSIAN_CLIENT_SECRET;
  const redirectUri = env.ATLASSIAN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Atlassian OAuth is not configured. Set ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET, and ATLASSIAN_REDIRECT_URI.'
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function resolveHmacKey(): Buffer {
  return resolveIntegrationEncryptionKey('sign Jira OAuth state (HMAC)');
}

function base64UrlEncode(value: string | Buffer): string {
  const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buf.toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function signState(payload: OAuthStatePayload): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', resolveHmacKey()).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

function verifyState(state: string): OAuthStatePayload {
  const [body, sigPart] = state.split('.');
  if (!body || !sigPart) {
    throw new Error('Invalid OAuth state.');
  }

  const expected = createHmac('sha256', resolveHmacKey()).update(body).digest();
  const actual = base64UrlDecode(sigPart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid OAuth state signature.');
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      base64UrlDecode(body).toString('utf8')
    ) as OAuthStatePayload;
  } catch {
    throw new Error('Invalid OAuth state payload.');
  }

  if (
    typeof payload.userId !== 'string' ||
    typeof payload.nonce !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new TypeError('Invalid OAuth state payload.');
  }

  if (Date.now() > payload.exp) {
    throw new Error('OAuth state has expired. Please try connecting again.');
  }

  return payload;
}

function extractText(node: JiraNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  let text = '';
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractText(child);
    }
  }
  return text;
}

function parseJiraDescription(descObj: unknown): string {
  if (!descObj) return '';
  if (typeof descObj === 'string') {
    return descObj;
  }
  if (typeof descObj === 'object') {
    return extractText(descObj as JiraNode);
  }
  return '';
}

function parseSearchIssues(data: JiraSearchResponse): ParsedJiraIssue[] {
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error('Invalid response format from Jira API');
  }

  return data.issues.map((issue) => {
    const jiraType = issue.fields?.issuetype?.name || '';
    return {
      key: issue.key,
      title: issue.fields?.summary || 'Untitled',
      description: parseJiraDescription(issue.fields?.description),
      type: mapToWorkItemType(jiraType),
      parentKey: issue.fields?.parent?.key || null,
    };
  });
}

async function requireJiraManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin, UserRoleEnum.manager],
    'Unauthorized. Only admins and managers can manage Jira connections.'
  );
}

export class JiraService {
  constructor(private readonly jiraRepository: JiraRepository) {}

  buildAuthorizeUrl(userId: string): string {
    const { clientId, redirectUri } = requireAtlassianConfig();
    const state = signState({
      userId,
      nonce: randomBytes(16).toString('hex'),
      exp: Date.now() + STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: OAUTH_SCOPES,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  async startOAuth(actorId: string): Promise<{ url: string }> {
    await requireJiraManager(actorId);
    return { url: this.buildAuthorizeUrl(actorId) };
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<JiraConnectionDto> {
    const { userId } = verifyState(state);
    await requireJiraManager(userId);

    const tokens = await this.exchangeAuthorizationCode(code);
    const resources = await this.fetchAccessibleResources(tokens.access_token);
    const site =
      resources.find((r) => r.scopes.some((s) => s.includes('jira'))) ??
      resources[0];

    if (!site) {
      throw new Error(
        'No accessible Atlassian Jira site found for this account.'
      );
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      throw new Error(
        'Atlassian did not return a refresh token. Ensure offline_access scope is granted.'
      );
    }

    return await this.jiraRepository.upsertByUserAndCloud({
      user_id: userId,
      cloud_id: site.id,
      site_url: site.url,
      account_email: null,
      refresh_token_enc: encryptSecret(refreshToken),
      access_token_enc: encryptSecret(tokens.access_token),
      access_token_expires_at: expiresAt,
      scopes: tokens.scope ?? site.scopes.join(' '),
      status: 'active',
    });
  }

  async listConnections(actorId: string): Promise<JiraConnectionDto[]> {
    await requireJiraManager(actorId);
    return await this.jiraRepository.listByUserId(actorId);
  }

  async deleteConnection(actorId: string, connectionId: string): Promise<void> {
    await requireJiraManager(actorId);
    const deleted = await this.jiraRepository.deleteByIdForUser(
      connectionId,
      actorId
    );
    if (!deleted) {
      throw new Error('Jira connection not found.');
    }
  }

  async listJiraProjects(
    actorId: string,
    connectionId: string
  ): Promise<JiraCloudProject[]> {
    await requireJiraManager(actorId);
    const connection = await this.requireOwnedActiveConnection(
      actorId,
      connectionId
    );
    const accessToken = await this.getValidAccessToken(connection);

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${connection.cloud_id}/rest/api/3/project/search?maxResults=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira project list failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as {
      values?: Array<{ id: string; key: string; name: string }>;
    };

    return (data.values ?? []).map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
    }));
  }

  /**
   * Fetch and parse issues for a connection + Jira project key via Cloud REST.
   * Uses Bearer token against the Atlassian gateway (no free-form host URLs).
   */
  async fetchIssuesForImport(
    actorId: string,
    connectionId: string,
    jiraProjectKey: string
  ): Promise<ParsedJiraIssue[]> {
    await requireJiraManager(actorId);
    const connection = await this.requireOwnedActiveConnection(
      actorId,
      connectionId
    );
    return await this.searchIssues(connection, jiraProjectKey);
  }

  /**
   * Preview/import helper for a project that already stores connection + key.
   */
  async fetchIssuesForProjectLink(
    actorId: string,
    connectionId: string,
    jiraProjectKey: string
  ): Promise<ParsedJiraIssue[]> {
    return await this.fetchIssuesForImport(
      actorId,
      connectionId,
      jiraProjectKey
    );
  }

  private async requireOwnedActiveConnection(
    actorId: string,
    connectionId: string
  ): Promise<JiraConnectionRow> {
    const connection = await this.jiraRepository.findByIdForUser(
      connectionId,
      actorId
    );
    if (!connection) {
      throw new Error('Jira connection not found.');
    }
    if (connection.status !== 'active') {
      throw new Error(
        `Jira connection is ${connection.status}. Reconnect Jira to continue.`
      );
    }
    return connection;
  }

  private async searchIssues(
    connection: JiraConnectionRow,
    jiraProjectKey: string
  ): Promise<ParsedJiraIssue[]> {
    const accessToken = await this.getValidAccessToken(connection);
    const jql = encodeURIComponent(`project="${jiraProjectKey.trim()}"`);
    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${connection.cloud_id}/rest/api/3/search/jql?jql=${jql}&fields=summary,description,issuetype,parent`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira API request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as JiraSearchResponse;
    return parseSearchIssues(data);
  }

  private async getValidAccessToken(
    connection: JiraConnectionRow
  ): Promise<string> {
    const expiresAt = connection.access_token_expires_at?.getTime() ?? 0;
    const stillValid =
      connection.access_token_enc &&
      expiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS;

    if (stillValid && connection.access_token_enc) {
      return decryptSecret(connection.access_token_enc);
    }

    return await this.refreshAccessToken(connection);
  }

  private async refreshAccessToken(
    connection: JiraConnectionRow
  ): Promise<string> {
    const { clientId, clientSecret } = requireAtlassianConfig();
    const refreshToken = decryptSecret(connection.refresh_token_enc);

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      await this.jiraRepository.updateTokens(connection.id, {
        status: 'expired',
      });
      const errorText = await response.text();
      throw new Error(
        `Failed to refresh Jira access token (${response.status}): ${errorText}`
      );
    }

    const tokens = (await response.json()) as AtlassianTokenResponse;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const nextRefresh = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : connection.refresh_token_enc;

    await this.jiraRepository.updateTokens(connection.id, {
      refresh_token_enc: nextRefresh,
      access_token_enc: encryptSecret(tokens.access_token),
      access_token_expires_at: expiresAt,
      status: 'active',
    });

    return tokens.access_token;
  }

  private async exchangeAuthorizationCode(
    code: string
  ): Promise<AtlassianTokenResponse> {
    const { clientId, clientSecret, redirectUri } = requireAtlassianConfig();

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Atlassian token exchange failed (${response.status}): ${errorText}`
      );
    }

    return (await response.json()) as AtlassianTokenResponse;
  }

  private async fetchAccessibleResources(
    accessToken: string
  ): Promise<AtlassianAccessibleResource[]> {
    const response = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to list Atlassian resources (${response.status}): ${errorText}`
      );
    }

    return (await response.json()) as AtlassianAccessibleResource[];
  }
}
