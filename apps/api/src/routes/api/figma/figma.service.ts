import { createHash, randomBytes } from 'node:crypto';
import { UserRoleEnum, utcNow } from '@repo/types';
import type { FigmaConnectionStatusDto } from '@repo/types/api/v1';
import { env } from '../../../config/env';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  createOAuthStateWithPayload,
  verifyOAuthState,
} from '../../../lib/secrets/oauth-state';
import {
  decryptSecret,
  encryptSecret,
} from '../../../lib/secrets/token-crypto';
import type { ProjectsRepository } from '../projects/projects.repository';
import {
  FigmaRepository,
  type FigmaCanonicalCredentialFull,
  type FigmaConnectionFull,
  type FigmaConnectionPublic,
  type FigmaEffectiveConnection,
  type FigmaVerificationFields,
} from './figma.repository';
import {
  FigmaTokenCoordinator,
  type TrustedFigmaAuthorizationContext,
} from './figma-token-coordinator';
import { FigmaTokenClient } from './figma-token-client';
import {
  FigmaOAuthStateError,
  type FigmaFileMetadataResponse,
} from './figma.types';

const FIGMA_AUTHORIZE_URL = 'https://www.figma.com/oauth';
const FIGMA_API_URL = 'https://api.figma.com/v1';
const FIGMA_SCOPE = 'file_metadata:read';
const FIGMA_STATE_PURPOSE = 'sign Figma OAuth state (HMAC)';
const FIGMA_STATE_TTL_MS = 5 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const RESOURCE_REQUEST_TIMEOUT_MS = 10_000;
const FIGMA_FILE_PATH_TYPES = new Set([
  'design',
  'file',
  'proto',
  'board',
  'slides',
]);

type FigmaConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type FigmaSharedProjectCredential = {
  connection: FigmaEffectiveConnection;
  identity: 'canonical' | 'legacy_unverified';
};

function requireFigmaConfig(): FigmaConfig {
  const clientId = env.FIGMA_CLIENT_ID;
  const clientSecret = env.FIGMA_CLIENT_SECRET;
  const redirectUri = env.FIGMA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Figma OAuth is not configured. Set FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, and FIGMA_REDIRECT_URI.'
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Stable, non-secret identity for the configured Figma OAuth application.
 * The client id is never persisted or returned directly.
 */
export function figmaOAuthAppKey(clientId = env.FIGMA_CLIENT_ID): string {
  if (!clientId) {
    throw new Error('Figma OAuth is not configured. Set FIGMA_CLIENT_ID.');
  }
  return `figma:sha256:${sha256(clientId)}`;
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function figmaFileKeyFromUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.hostname !== 'figma.com' && url.hostname !== 'www.figma.com') {
      return null;
    }
    const [kind, key] = url.pathname.split('/').filter(Boolean);
    if (!kind || !key || !FIGMA_FILE_PATH_TYPES.has(kind)) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

export class FigmaService {
  private readonly sharedOAuthEnabled: boolean;
  private readonly recovery401Enabled: boolean;
  private tokenClient?: FigmaTokenClient;
  private tokenCoordinator?: FigmaTokenCoordinator;

  constructor(
    private readonly figmaRepository: FigmaRepository,
    private readonly projectsRepository: Pick<
      ProjectsRepository,
      'listAccessibleProjectIds'
    >,
    options: {
      sharedOAuthEnabled?: boolean;
      recovery401Enabled?: boolean;
      tokenClient?: FigmaTokenClient;
      tokenCoordinator?: FigmaTokenCoordinator;
    } = {}
  ) {
    this.sharedOAuthEnabled =
      options.sharedOAuthEnabled ?? env.FIGMA_SHARED_OAUTH_ENABLED === 'true';
    this.recovery401Enabled =
      options.recovery401Enabled ??
      env.FIGMA_SHARED_OAUTH_401_RECOVERY_ENABLED === 'true';
    this.tokenClient = options.tokenClient;
    this.tokenCoordinator = options.tokenCoordinator;
  }

  async startOAuth(
    actorId: string,
    projectId: string
  ): Promise<{ url: string }> {
    await this.requireCanManageProject(actorId, projectId);
    const { clientId, redirectUri } = requireFigmaConfig();
    const codeVerifier = randomBytes(48).toString('base64url');
    const { state, payload } = createOAuthStateWithPayload(
      actorId,
      FIGMA_STATE_PURPOSE,
      { projectId, ttlMs: FIGMA_STATE_TTL_MS }
    );

    const attempt = {
      projectId,
      userId: actorId,
      nonceHash: sha256(payload.nonce),
      codeVerifierEnc: encryptSecret(codeVerifier),
      expiresAt: new Date(payload.exp),
    };
    if (this.sharedOAuthEnabled) {
      await this.figmaRepository.createCoordinatedOAuthAttempt({
        ...attempt,
        oauthAppKey: figmaOAuthAppKey(clientId),
      });
    } else {
      await this.figmaRepository.createOAuthAttempt(attempt);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: FIGMA_SCOPE,
      state,
      response_type: 'code',
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });
    return { url: `${FIGMA_AUTHORIZE_URL}?${params.toString()}` };
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<FigmaConnectionStatusDto> {
    if (this.sharedOAuthEnabled) {
      return this.handleSharedOAuthCallback(code, state);
    }

    const { payload, codeVerifier } = await this.consumeState(state);
    await this.requireCanManageProject(payload.userId, payload.projectId);

    const tokens = await this.getTokenClient().exchangeAuthorizationCode(
      code,
      codeVerifier
    );

    const project = await this.requireProject(payload.projectId);
    const verification = await this.verifySavedDesign(
      tokens.access_token,
      project.figma_url
    );
    const expiresAt = new Date(utcNow().getTime() + tokens.expires_in * 1000);
    const connection = await this.figmaRepository.upsertConnection({
      projectId: payload.projectId,
      authorizedBy: payload.userId,
      figmaUserId: tokens.user_id_string,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      accessTokenExpiresAt: expiresAt,
      scopes: FIGMA_SCOPE,
      verification,
    });

    return this.toStatusDto(payload.projectId, project.figma_url, connection);
  }

  async handleOAuthDenial(state: string): Promise<void> {
    const { payload } = await this.consumeState(state);
    await this.requireCanManageProject(payload.userId, payload.projectId);
  }

  async getConnectionStatus(
    actorId: string,
    projectId: string
  ): Promise<FigmaConnectionStatusDto> {
    await this.requireCanManageProject(actorId, projectId);
    const [project, connection] = await Promise.all([
      this.requireProject(projectId),
      this.figmaRepository.findConnectionByProjectId(projectId),
    ]);
    return this.toStatusDto(projectId, project.figma_url, connection);
  }

  async verifyCurrentDesign(
    actorId: string,
    projectId: string
  ): Promise<FigmaConnectionStatusDto> {
    await this.requireCanManageProject(actorId, projectId);
    const project = await this.requireProject(projectId);
    let verification: FigmaVerificationFields;
    if (this.sharedOAuthEnabled) {
      const connection =
        await this.figmaRepository.findCredentialByProjectBinding(
          projectId,
          figmaOAuthAppKey()
        );
      if (!connection) {
        throw new Error('Figma connection not found. Connect Figma first.');
      }
      verification = await this.verifySavedDesignWithRecovery(
        connection,
        project.figma_url
      );
    } else {
      const connection =
        await this.figmaRepository.findFullConnectionByProjectId(projectId);
      if (!connection) {
        throw new Error('Figma connection not found. Connect Figma first.');
      }
      verification = await this.verifySavedDesign(
        await this.getValidAccessToken(connection),
        project.figma_url
      );
    }
    const updated = await this.figmaRepository.updateVerification(
      projectId,
      verification
    );
    return this.toStatusDto(projectId, project.figma_url, updated);
  }

  async disconnect(actorId: string, projectId: string): Promise<void> {
    await this.requireCanManageProject(actorId, projectId);
    const deleted = await this.figmaRepository.deleteConnection(projectId);
    if (!deleted) {
      throw new Error('Figma connection not found.');
    }
  }

  /**
   * Phase 3 preparation only; no production route calls this method. Shared
   * credential creation, identity lookup, and rebinding remain unavailable
   * until a future callback can provide trusted server-side OAuth context.
   * Reads are limited to the authorized project's existing binding. Legacy
   * rows remain unverified and are never silently promoted.
   */
  async findSharedCredentialForProject(
    actorId: string,
    projectId: string
  ): Promise<FigmaSharedProjectCredential | null> {
    await this.requireCanManageProject(actorId, projectId);
    const connection =
      await this.figmaRepository.findCredentialByProjectBinding(
        projectId,
        figmaOAuthAppKey()
      );
    if (!connection) {
      return null;
    }
    return {
      connection,
      identity: connection.oauth_app_verified
        ? 'canonical'
        : 'legacy_unverified',
    };
  }

  /** Removes one project binding without deleting the shared credential. */
  async disconnectProjectFromCanonicalCredential(
    actorId: string,
    projectId: string
  ): Promise<void> {
    await this.requireCanManageProject(actorId, projectId);
    const deleted = await this.figmaRepository.deleteProjectBinding(projectId);
    if (!deleted) {
      throw new Error('Figma connection not found.');
    }
  }

  private async requireCanManageProject(
    actorId: string,
    projectId: string
  ): Promise<void> {
    await requireUserWithRole(
      actorId,
      [UserRoleEnum.admin, UserRoleEnum.manager],
      'Unauthorized. Only admins and managers can manage Figma connections.'
    );
    const accessibleProjectIds =
      await this.projectsRepository.listAccessibleProjectIds(actorId);
    if (!accessibleProjectIds.includes(projectId)) {
      throw new Error(
        'Unauthorized. You do not have permission to manage this project.'
      );
    }
  }

  private async requireProject(projectId: string) {
    const project = await this.figmaRepository.getProject(projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    return project;
  }

  private async consumeState(state: string): Promise<{
    payload: { userId: string; projectId: string; nonce: string };
    codeVerifier: string;
  }> {
    let verified: ReturnType<typeof verifyOAuthState>;
    try {
      verified = verifyOAuthState(state, FIGMA_STATE_PURPOSE);
    } catch {
      throw new FigmaOAuthStateError();
    }
    if (!verified.projectId) {
      throw new FigmaOAuthStateError();
    }

    const attempt = await this.figmaRepository.consumeOAuthAttempt({
      projectId: verified.projectId,
      userId: verified.userId,
      nonceHash: sha256(verified.nonce),
    });
    if (!attempt) {
      throw new FigmaOAuthStateError();
    }
    return {
      payload: {
        userId: verified.userId,
        projectId: verified.projectId,
        nonce: verified.nonce,
      },
      codeVerifier: decryptSecret(attempt.code_verifier_enc),
    };
  }

  private verifyTrustedState(state: string): {
    userId: string;
    projectId: string;
    nonce: string;
  } {
    let verified: ReturnType<typeof verifyOAuthState>;
    try {
      verified = verifyOAuthState(state, FIGMA_STATE_PURPOSE);
    } catch {
      throw new FigmaOAuthStateError();
    }
    if (!verified.projectId) throw new FigmaOAuthStateError();
    return {
      userId: verified.userId,
      projectId: verified.projectId,
      nonce: verified.nonce,
    };
  }

  private async handleSharedOAuthCallback(
    code: string,
    state: string
  ): Promise<FigmaConnectionStatusDto> {
    const payload = this.verifyTrustedState(state);
    await this.requireCanManageProject(payload.userId, payload.projectId);
    const context: TrustedFigmaAuthorizationContext = {
      oauthAppKey: figmaOAuthAppKey(),
      projectId: payload.projectId,
      userId: payload.userId,
      nonceHash: sha256(payload.nonce),
      authorizationCode: code,
    };
    const result = await this.getTokenCoordinator().exchangeAuthorizationCode(
      context,
      async () => {
        await this.requireCanManageProject(payload.userId, payload.projectId);
        return true;
      }
    );
    if (!result.bound) {
      throw new Error(
        'The Figma authorization completed, but the project connection changed before it could be applied.'
      );
    }
    const project = await this.requireProject(payload.projectId);
    const connection =
      await this.figmaRepository.findCredentialByProjectBinding(
        payload.projectId,
        context.oauthAppKey
      );
    if (!connection) {
      throw new Error(
        'Figma connection could not be loaded after authorization.'
      );
    }
    const verification = await this.verifySavedDesignWithRecovery(
      connection,
      project.figma_url
    );
    const updated = await this.figmaRepository.updateVerification(
      payload.projectId,
      verification
    );
    return this.toStatusDto(payload.projectId, project.figma_url, updated);
  }

  private async refreshAccessToken(
    connection: FigmaConnectionFull
  ): Promise<string> {
    const tokens = await this.getTokenClient().refresh(
      decryptSecret(connection.refresh_token_enc)
    );
    const expiresAt = new Date(utcNow().getTime() + tokens.expires_in * 1000);
    await this.figmaRepository.updateTokens(connection.project_id, {
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : undefined,
      accessTokenExpiresAt: expiresAt,
    });
    return tokens.access_token;
  }

  private getTokenClient(): FigmaTokenClient {
    this.tokenClient ??= new FigmaTokenClient(requireFigmaConfig(), {
      fetch: (input, init) => fetch(input, init),
    });
    return this.tokenClient;
  }

  private getTokenCoordinator(): FigmaTokenCoordinator {
    this.tokenCoordinator ??= new FigmaTokenCoordinator(
      this.figmaRepository,
      this.getTokenClient()
    );
    return this.tokenCoordinator;
  }

  private async getValidAccessToken(
    connection: FigmaConnectionFull
  ): Promise<string> {
    if (
      connection.access_token_expires_at.getTime() >
      utcNow().getTime() + TOKEN_EXPIRY_SKEW_MS
    ) {
      return decryptSecret(connection.access_token_enc);
    }
    return this.refreshAccessToken(connection);
  }

  private async getValidCanonicalCredential(
    connection: FigmaEffectiveConnection,
    forceRefresh: boolean
  ): Promise<FigmaCanonicalCredentialFull> {
    if (
      !connection.credential_id ||
      connection.token_version === null ||
      connection.oauth_app_key !== figmaOAuthAppKey()
    ) {
      throw new Error(
        'The Figma project does not have a trusted shared credential.'
      );
    }
    return this.getTokenCoordinator().refreshCredential({
      oauthAppKey: connection.oauth_app_key,
      credentialId: connection.credential_id,
      expectedTokenVersion: connection.token_version,
      force: forceRefresh,
    });
  }

  private async verifySavedDesignWithRecovery(
    connection: FigmaEffectiveConnection,
    figmaUrl: string | null
  ): Promise<FigmaVerificationFields> {
    if (connection.credential_source !== 'canonical') {
      return this.verifySavedDesign(
        await this.getValidAccessToken(connection),
        figmaUrl
      );
    }
    if (connection.credential_status !== 'active') {
      throw new Error(
        'The Figma credential needs to be reauthorized before it can be used.'
      );
    }

    let credential: FigmaCanonicalCredentialFull;
    if (
      connection.access_token_expires_at.getTime() <=
      utcNow().getTime() + TOKEN_EXPIRY_SKEW_MS
    ) {
      credential = await this.getValidCanonicalCredential(connection, false);
    } else {
      credential = {
        id: connection.credential_id!,
        oauth_app_key: connection.oauth_app_key!,
        figma_user_id: connection.figma_user_id,
        access_token_enc: connection.access_token_enc,
        refresh_token_enc: connection.refresh_token_enc,
        access_token_expires_at: connection.access_token_expires_at,
        scopes: connection.scopes,
        status: connection.credential_status!,
        token_version: connection.token_version!,
        last_validated_at: connection.last_validated_at,
        last_authorized_by: null,
        created_at: connection.created_at,
        updated_at: connection.updated_at,
      };
    }

    const first = await this.requestSavedDesign(
      decryptSecret(credential.access_token_enc),
      figmaUrl
    );
    if (
      first.responseStatus !== 401 ||
      !this.recovery401Enabled ||
      !this.sharedOAuthEnabled
    ) {
      return first.verification;
    }

    const refreshed = await this.getTokenCoordinator().refreshCredential({
      oauthAppKey: credential.oauth_app_key,
      credentialId: credential.id,
      expectedTokenVersion: credential.token_version,
      force: true,
    });
    const retried = await this.requestSavedDesign(
      decryptSecret(refreshed.access_token_enc),
      figmaUrl
    );
    return retried.verification;
  }

  private async verifySavedDesign(
    accessToken: string,
    figmaUrl: string | null
  ): Promise<FigmaVerificationFields> {
    return (await this.requestSavedDesign(accessToken, figmaUrl)).verification;
  }

  private async requestSavedDesign(
    accessToken: string,
    figmaUrl: string | null
  ): Promise<{
    verification: FigmaVerificationFields;
    responseStatus: number | null;
  }> {
    if (!figmaUrl) {
      return {
        verification: {
          verifiedFileKey: null,
          verifiedFileName: null,
          verifiedAt: null,
          verificationError: null,
        },
        responseStatus: null,
      };
    }
    const fileKey = figmaFileKeyFromUrl(figmaUrl);
    if (!fileKey) {
      return {
        verification: this.failedVerification(
          'The saved Figma link does not identify a supported design file.'
        ),
        responseStatus: null,
      };
    }

    let response: Response;
    try {
      response = await fetch(
        `${FIGMA_API_URL}/files/${encodeURIComponent(fileKey)}/meta`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(RESOURCE_REQUEST_TIMEOUT_MS),
        }
      );
    } catch {
      return {
        verification: this.failedVerification(
          'Figma design access could not be verified. Try again.'
        ),
        responseStatus: null,
      };
    }
    let data: FigmaFileMetadataResponse = {};
    try {
      data = (await response.json()) as FigmaFileMetadataResponse;
    } catch {
      // Status-specific handling below still gives the useful result.
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          verification: this.failedVerification(
            'The connected Figma account cannot access the saved design link.'
          ),
          responseStatus: response.status,
        };
      }
      if (response.status === 404) {
        return {
          verification: this.failedVerification(
            'The saved Figma design was not found.'
          ),
          responseStatus: response.status,
        };
      }
      return {
        verification: this.failedVerification(
          'Figma design access could not be verified.'
        ),
        responseStatus: response.status,
      };
    }

    return {
      verification: {
        verifiedFileKey: fileKey,
        verifiedFileName: data.file?.name ?? null,
        verifiedAt: utcNow(),
        verificationError: null,
      },
      responseStatus: response.status,
    };
  }

  private failedVerification(message: string): FigmaVerificationFields {
    return {
      verifiedFileKey: null,
      verifiedFileName: null,
      verifiedAt: utcNow(),
      verificationError: message,
    };
  }

  private toStatusDto(
    projectId: string,
    figmaUrl: string | null,
    connection: FigmaConnectionPublic | null
  ): FigmaConnectionStatusDto {
    if (!connection) {
      return {
        project_id: projectId,
        connected: false,
        figma_user_id: null,
        scopes: null,
        expires_at: null,
        authorized_by_user_id: null,
        authorized_by_name: null,
        design_access_verified: false,
        verified_file_key: null,
        verified_file_name: null,
        verified_at: null,
        verification_error: null,
      };
    }

    const currentFileKey = figmaFileKeyFromUrl(figmaUrl);
    const matchesCurrentFile = Boolean(
      currentFileKey && connection.verified_file_key === currentFileKey
    );
    const designAccessVerified =
      matchesCurrentFile && !connection.verification_error;
    let verificationError = connection.verification_error;
    if (!figmaUrl) {
      verificationError = null;
    } else if (!currentFileKey) {
      verificationError =
        'The saved Figma link does not identify a supported design file.';
    } else if (!matchesCurrentFile && !verificationError) {
      verificationError =
        'Design access has not been verified for the current saved link.';
    }

    return {
      project_id: projectId,
      connected: true,
      figma_user_id: connection.figma_user_id,
      scopes: connection.scopes,
      expires_at: connection.access_token_expires_at.toISOString(),
      authorized_by_user_id: connection.authorized_by,
      authorized_by_name: connection.authorized_by_user.name,
      design_access_verified: designAccessVerified,
      verified_file_key: designAccessVerified
        ? connection.verified_file_key
        : null,
      verified_file_name: designAccessVerified
        ? connection.verified_file_name
        : null,
      verified_at: designAccessVerified
        ? (connection.verified_at?.toISOString() ?? null)
        : null,
      verification_error: verificationError,
    };
  }
}
