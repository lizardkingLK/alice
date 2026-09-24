import { env } from '../../../config/env';
import {
  decryptSecret,
  encryptSecret,
} from '../../../lib/secrets/token-crypto';
import {
  createOAuthState,
  verifyOAuthState,
} from '../../../lib/secrets/oauth-state';
import {
  IntegrationStatus,
  Prisma,
  type integrations,
} from '@repo/types/prisma';
import { UserRoleEnum, utcNow } from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import type { GithubRepository } from './github.repository';
import {
  GithubConnectionStatusEnum,
  GithubInsufficientScopeError,
  GithubReauthorizationRequiredError,
  type GithubApiRepoResponse,
  type GithubConnectionDto,
  type GithubOAuthConfigStored,
  type GithubRepoOption,
  type GithubTokenResponse,
  type GithubUserResponse,
} from './github.types';

const OAUTH_SCOPES = 'repo read:user';
const ACCESS_TOKEN_SKEW_MS = 60 * 1000;
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';

async function requireGithubManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin, UserRoleEnum.manager],
    'Unauthorized. Only admins and managers can manage GitHub connections.'
  );
}

function requireGithubConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = env.GITHUB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI.'
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export class GithubService {
  constructor(private readonly githubRepository: GithubRepository) {}

  buildAuthorizeUrl(userId: string): string {
    const { clientId, redirectUri } = requireGithubConfig();
    const state = createOAuthState(userId, 'sign GitHub OAuth state (HMAC)');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: OAUTH_SCOPES,
      state,
      prompt: 'select_account',
    });

    return `${GITHUB_OAUTH_URL}/authorize?${params.toString()}`;
  }

  async startOAuth(actorId: string): Promise<{ url: string }> {
    await requireGithubManager(actorId);
    return { url: this.buildAuthorizeUrl(actorId) };
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<GithubConnectionDto> {
    const { userId } = verifyOAuthState(
      state,
      'sign GitHub OAuth state (HMAC)'
    );
    await requireGithubManager(userId);

    const tokens = await this.exchangeAuthorizationCode(code);
    const userInfo = await this.fetchUserProfile(tokens.access_token);

    const expiresAt = tokens.expires_in
      ? new Date(utcNow().getTime() + tokens.expires_in * 1000).toISOString()
      : undefined;

    const storedConfig: GithubOAuthConfigStored = {
      kind: 'github_oauth',
      access_token: encryptSecret(tokens.access_token),
      refresh_token: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : undefined,
      expires_at: expiresAt,
      scope: tokens.scope ?? OAUTH_SCOPES,
      account_login: userInfo.login,
      account_id: userInfo.id,
      account_name: userInfo.name ?? undefined,
      account_avatar_url: userInfo.avatar_url ?? undefined,
    };

    const row = await this.githubRepository.upsertConnection({
      userId,
      name: `GitHub (@${userInfo.login})`,
      config: storedConfig as unknown as Prisma.InputJsonValue,
      status: IntegrationStatus.active,
    });

    return this.toConnectionDto(row);
  }

  async listConnections(actorId: string): Promise<GithubConnectionDto[]> {
    await requireGithubManager(actorId);
    const rows = await this.githubRepository.listByUserId(actorId);
    if (rows.length > 0) {
      return rows.map((r) => this.toConnectionDto(r));
    }

    const allActive = await this.githubRepository.listAllActive();
    return allActive.map((r) => this.toConnectionDto(r));
  }

  async deleteConnection(actorId: string, id: string): Promise<void> {
    await requireGithubManager(actorId);
    const deleted = await this.githubRepository.deleteById(id, actorId);
    if (!deleted) {
      throw new Error('GitHub connection not found.');
    }
  }

  async getValidAccessToken(connectionId?: string): Promise<string> {
    const connection = connectionId
      ? await this.githubRepository.findById(connectionId)
      : await this.githubRepository.findActive();

    if (!connection) {
      throw new GithubReauthorizationRequiredError(
        'No active GitHub integration found. Please connect GitHub to continue.'
      );
    }

    if (connection.status !== IntegrationStatus.active) {
      throw new GithubReauthorizationRequiredError(
        `GitHub connection is ${connection.status}. Reconnect GitHub to continue.`
      );
    }

    const config = connection.config as unknown as GithubOAuthConfigStored;
    if (!config?.access_token) {
      throw new GithubReauthorizationRequiredError(
        'GitHub access token is missing. Please reconnect GitHub.'
      );
    }

    if (!this.hasRequiredScopes(config.scope)) {
      throw new GithubInsufficientScopeError(
        'GitHub connection has insufficient permissions. Reconnecting with required scopes is needed.'
      );
    }

    const expiresAt = config.expires_at
      ? new Date(config.expires_at).getTime()
      : null;
    const isExpired =
      expiresAt !== null &&
      expiresAt <= utcNow().getTime() + ACCESS_TOKEN_SKEW_MS;

    if (!isExpired) {
      return decryptSecret(config.access_token);
    }

    if (!config.refresh_token) {
      await this.githubRepository.updateStatus(
        connection.id,
        IntegrationStatus.disabled
      );
      throw new GithubReauthorizationRequiredError(
        'GitHub access token has expired and no refresh token is available. Please reconnect GitHub.'
      );
    }

    return await this.refreshAccessToken(connection.id, config);
  }

  async listRepositories(
    actorId: string,
    connectionId?: string
  ): Promise<GithubRepoOption[]> {
    await requireGithubManager(actorId);
    const accessToken = await this.getValidAccessToken(connectionId);

    const response = await fetch(
      `${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Alice-App',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new GithubReauthorizationRequiredError(
          'GitHub authorization has expired or was revoked. Please reconnect GitHub.'
        );
      }
      const errorText = await response.text();
      throw new Error(
        `GitHub API repository listing failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as GithubApiRepoResponse[];
    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: {
        login: repo.owner?.login ?? '',
        avatar_url: repo.owner?.avatar_url,
      },
      private: repo.private,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      description: repo.description,
    }));
  }

  private hasRequiredScopes(grantedScope?: string): boolean {
    if (!grantedScope) {
      return true;
    }
    const scopes = new Set(
      grantedScope
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
    return scopes.has('repo') || scopes.has('public_repo');
  }

  private async refreshAccessToken(
    connectionId: string,
    currentConfig: GithubOAuthConfigStored
  ): Promise<string> {
    const { clientId, clientSecret } = requireGithubConfig();
    const refreshToken = decryptSecret(currentConfig.refresh_token!);

    const response = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      await this.githubRepository.updateStatus(
        connectionId,
        IntegrationStatus.disabled
      );
      const errorText = await response.text();
      throw new GithubReauthorizationRequiredError(
        `Failed to refresh GitHub access token (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as GithubTokenResponse;
    if (data.error) {
      await this.githubRepository.updateStatus(
        connectionId,
        IntegrationStatus.disabled
      );
      throw new GithubReauthorizationRequiredError(
        `GitHub token refresh failed: ${data.error_description || data.error}`
      );
    }

    const expiresAt = data.expires_in
      ? new Date(utcNow().getTime() + data.expires_in * 1000).toISOString()
      : currentConfig.expires_at;

    const nextRefreshToken = data.refresh_token
      ? encryptSecret(data.refresh_token)
      : currentConfig.refresh_token;

    const updatedConfig: GithubOAuthConfigStored = {
      ...currentConfig,
      access_token: encryptSecret(data.access_token),
      refresh_token: nextRefreshToken,
      expires_at: expiresAt,
      scope: data.scope ?? currentConfig.scope,
    };

    await this.githubRepository.updateConfig(
      connectionId,
      updatedConfig as unknown as Prisma.InputJsonValue,
      IntegrationStatus.active
    );

    return data.access_token;
  }

  private async exchangeAuthorizationCode(
    code: string
  ): Promise<GithubTokenResponse> {
    const { clientId, clientSecret, redirectUri } = requireGithubConfig();

    const response = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub token exchange failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as GithubTokenResponse;
    if (data.error) {
      throw new Error(
        `GitHub authorization error: ${data.error_description || data.error}`
      );
    }

    return data;
  }

  private async fetchUserProfile(
    accessToken: string
  ): Promise<GithubUserResponse> {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Alice-App',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch GitHub user profile (${response.status}): ${errorText}`
      );
    }

    return (await response.json()) as GithubUserResponse;
  }

  private toConnectionDto(row: integrations): GithubConnectionDto {
    const config = (row.config as unknown as GithubOAuthConfigStored) || {};
    return {
      id: row.id,
      name: row.name,
      status:
        row.status === IntegrationStatus.active
          ? GithubConnectionStatusEnum.active
          : GithubConnectionStatusEnum.revoked,
      account_login: config.account_login || 'unknown',
      account_id: config.account_id,
      account_name: config.account_name,
      account_avatar_url: config.account_avatar_url,
      scope: config.scope,
      expires_at: config.expires_at || null,
      has_access_token: Boolean(config.access_token),
      has_refresh_token: Boolean(config.refresh_token),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
