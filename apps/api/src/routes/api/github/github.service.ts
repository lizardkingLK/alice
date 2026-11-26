import {
  decryptSecret,
  encryptSecret,
} from '../../../lib/secrets/token-crypto';
import {
  createOAuthState,
  verifyOAuthState,
} from '../../../lib/secrets/oauth-state';
import { VersionControlConnectionStatus } from '@repo/types/prisma';
import {
  UserRoleEnum,
  utcNow,
  GithubAuthModeEnum,
  GithubAccountTypeEnum,
  buildGithubProviderConfig,
  tryParseGithubProviderConfig,
  type GithubAccountType,
  type GithubProviderConfig,
} from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import type {
  GithubRepository,
  VcConnectionFull,
  VcConnectionPublic,
} from './github.repository';
import {
  createInstallationAccessToken,
  fetchGithubAppMetadata,
  fetchGithubInstallation,
  requireGithubAppConfig,
} from './github-app-auth';
import {
  GithubConnectionStatusEnum,
  GithubReauthorizationRequiredError,
  type GithubApiRepoResponse,
  type GithubConnectionDto,
  type GithubInstallationRepositoriesResponse,
  type GithubRepoOption,
} from './github.types';

const APP_INSTALLATION_SCOPES = 'github_app:installation';
const ACCESS_TOKEN_SKEW_MS = 60 * 1000;
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_APP_INSTALL_STATE_PURPOSE = 'sign GitHub App install state (HMAC)';

async function requireGithubManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin, UserRoleEnum.manager],
    'Unauthorized. Only admins and managers can manage GitHub connections.'
  );
}

export class GithubService {
  constructor(private readonly githubRepository: GithubRepository) {}

  buildAppInstallUrl(userId: string, appSlug: string): string {
    requireGithubAppConfig();
    const state = createOAuthState(userId, GITHUB_APP_INSTALL_STATE_PURPOSE);
    const params = new URLSearchParams({ state });
    return `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new?${params.toString()}`;
  }

  async startAppInstall(actorId: string): Promise<{ url: string }> {
    await requireGithubManager(actorId);
    await this.assertCanEstablishConnection(actorId);
    const app = await fetchGithubAppMetadata();
    if (!app.slug) {
      throw new Error('GitHub App metadata did not include a slug.');
    }
    return { url: this.buildAppInstallUrl(actorId, app.slug) };
  }

  async handleAppInstallCallback(
    installationIdRaw: string,
    state: string
  ): Promise<GithubConnectionDto> {
    const { userId } = verifyOAuthState(
      state,
      GITHUB_APP_INSTALL_STATE_PURPOSE
    );
    const actor = await requireGithubManager(userId);
    await this.assertCanEstablishConnection(userId);

    const installationId = Number(installationIdRaw);
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new Error('Invalid GitHub App installation_id.');
    }

    const installation = await fetchGithubInstallation(installationId);
    const account = installation.account;
    if (!account?.login) {
      throw new Error('GitHub App installation is missing account metadata.');
    }

    const accountType = this.parseAccountType(account.type);
    const minted = await createInstallationAccessToken(installationId);
    const expiresAt = new Date(minted.expires_at);

    const row = await this.githubRepository.upsertConnection({
      userId,
      externalId: String(installationId),
      displayLabel: `GitHub App (@${account.login})`,
      providerConfig: buildGithubProviderConfig({
        auth_mode: GithubAuthModeEnum.app,
        account_login: account.login,
        account_name: account.name ?? null,
        account_avatar_url: account.avatar_url ?? null,
        account_type: accountType,
        installation_id: installationId,
      }),
      refreshTokenEnc: '',
      accessTokenEnc: encryptSecret(minted.token),
      accessTokenExpiresAt: expiresAt,
      scopes: APP_INSTALLATION_SCOPES,
      status: VersionControlConnectionStatus.active,
    });

    return this.toConnectionDto(row, userId, actor.role);
  }

  async listConnections(actorId: string): Promise<GithubConnectionDto[]> {
    const actor = await requireUserWithRole(
      actorId,
      [UserRoleEnum.admin, UserRoleEnum.manager, UserRoleEnum.member],
      'Unauthorized. Please log in to view GitHub connections.'
    );

    const rows = await this.githubRepository.listByUserId(actorId);
    if (rows.length > 0) {
      return rows.map((r) => this.toConnectionDto(r, actorId, actor.role));
    }

    const allActive = await this.githubRepository.listAllActive();
    return allActive.map((r) => this.toConnectionDto(r, actorId, actor.role));
  }

  async deleteConnection(actorId: string, id: string): Promise<void> {
    await requireGithubManager(actorId);
    const connection = await this.githubRepository.findById(id);
    if (!connection) {
      throw new Error('GitHub connection not found.');
    }

    const isCreatedByAdmin = connection.user?.role === UserRoleEnum.admin;

    if (isCreatedByAdmin && connection.user_id !== actorId) {
      throw new Error(
        'This GitHub connection was established by an administrator and can only be disconnected by that administrator.'
      );
    }

    const deleted = await this.githubRepository.deleteById(id);
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

    if (connection.status !== VersionControlConnectionStatus.active) {
      throw new GithubReauthorizationRequiredError(
        `GitHub connection is ${connection.status}. Reconnect GitHub to continue.`
      );
    }

    const config = tryParseGithubProviderConfig(connection.provider_config);
    if (config?.auth_mode !== GithubAuthModeEnum.app) {
      throw new GithubReauthorizationRequiredError(
        'GitHub user OAuth is retired. Install the GitHub App to continue.'
      );
    }

    return await this.getValidInstallationToken(connection, config);
  }

  async listRepositories(
    actorId: string,
    connectionId?: string
  ): Promise<GithubRepoOption[]> {
    await requireGithubManager(actorId);

    const accessToken = await this.getValidAccessToken(connectionId);

    const response = await fetch(
      `${GITHUB_API_URL}/installation/repositories?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
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

    const payload =
      (await response.json()) as GithubInstallationRepositoriesResponse;
    return (payload.repositories ?? []).map((repo) => this.mapApiRepo(repo));
  }

  private async assertCanEstablishConnection(actorId: string): Promise<void> {
    const activeAdminConn =
      await this.githubRepository.findActiveAdminConnection();
    if (
      activeAdminConn?.user_id != null &&
      activeAdminConn.user_id !== actorId
    ) {
      throw new Error(
        'An administrator has connected GitHub. That administrator must disconnect the existing connection before a different account can be connected.'
      );
    }
  }

  private parseAccountType(
    value: string | null | undefined
  ): GithubAccountType | null {
    if (value === GithubAccountTypeEnum.User) {
      return GithubAccountTypeEnum.User;
    }
    if (value === GithubAccountTypeEnum.Organization) {
      return GithubAccountTypeEnum.Organization;
    }
    return null;
  }

  private mapApiRepo(repo: GithubApiRepoResponse): GithubRepoOption {
    return {
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
    };
  }

  private async getValidInstallationToken(
    connection: VcConnectionFull,
    config: GithubProviderConfig
  ): Promise<string> {
    const installationId = config.installation_id;
    if (installationId == null) {
      throw new GithubReauthorizationRequiredError(
        'GitHub App installation_id is missing. Please reinstall the GitHub App.'
      );
    }

    const expiresAt = connection.access_token_expires_at
      ? connection.access_token_expires_at.getTime()
      : null;
    const isExpired =
      expiresAt === null ||
      expiresAt <= utcNow().getTime() + ACCESS_TOKEN_SKEW_MS;

    if (!isExpired && connection.access_token_enc) {
      return decryptSecret(connection.access_token_enc);
    }

    try {
      const minted = await createInstallationAccessToken(installationId);
      const nextExpiresAt = new Date(minted.expires_at);
      await this.githubRepository.updateTokens(connection.id, {
        accessTokenEnc: encryptSecret(minted.token),
        refreshTokenEnc: '',
        accessTokenExpiresAt: nextExpiresAt,
        scopes: APP_INSTALLATION_SCOPES,
      });
      return minted.token;
    } catch (error) {
      await this.githubRepository.updateStatus(
        connection.id,
        VersionControlConnectionStatus.expired
      );
      const detail =
        error instanceof Error ? error.message : 'Unknown minting error';
      throw new GithubReauthorizationRequiredError(
        `Failed to mint GitHub App installation token. Reinstall the GitHub App. (${detail})`
      );
    }
  }

  private toConnectionDto(
    row: VcConnectionPublic | VcConnectionFull,
    actorId?: string,
    actorRole?: string
  ): GithubConnectionDto {
    const config = tryParseGithubProviderConfig(row.provider_config);
    const createdByRole = row.user?.role;
    const isAdminOwned = createdByRole === UserRoleEnum.admin;
    const canManage = isAdminOwned
      ? Boolean(actorId && row.user_id === actorId)
      : actorRole === UserRoleEnum.admin || actorRole === UserRoleEnum.manager;

    const full = row as VcConnectionFull;
    const hasTokenFields = 'access_token_enc' in row;
    const expiresAt =
      hasTokenFields && full.access_token_expires_at
        ? full.access_token_expires_at.toISOString()
        : null;

    return {
      id: row.id,
      name:
        row.display_label || `GitHub (@${config?.account_login ?? 'unknown'})`,
      status:
        row.status === VersionControlConnectionStatus.active
          ? GithubConnectionStatusEnum.active
          : GithubConnectionStatusEnum.revoked,
      auth_mode: config?.auth_mode ?? GithubAuthModeEnum.app,
      account_login: config?.account_login || 'unknown',
      account_id: row.external_id,
      account_name: config?.account_name ?? undefined,
      account_avatar_url: config?.account_avatar_url ?? undefined,
      account_type: config?.account_type ?? null,
      installation_id: config?.installation_id ?? null,
      scope: row.scopes,
      expires_at: expiresAt,
      has_access_token: hasTokenFields
        ? Boolean(full.access_token_enc)
        : row.status === VersionControlConnectionStatus.active,
      has_refresh_token: hasTokenFields
        ? Boolean(full.refresh_token_enc)
        : row.status === VersionControlConnectionStatus.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      authorized_repo: config?.authorized_repo || null,
      repositories: config?.repositories,
      created_by_user_id: row.user_id,
      created_by_role: createdByRole,
      created_by_name: row.user?.name || null,
      is_admin_owned: isAdminOwned,
      can_manage: canManage,
    };
  }
}
