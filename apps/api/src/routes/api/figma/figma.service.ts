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
  type FigmaConnectionFull,
  type FigmaConnectionPublic,
  type FigmaVerificationFields,
} from './figma.repository';
import {
  FigmaOAuthStateError,
  type FigmaFileMetadataResponse,
  type FigmaOAuthTokenResponse,
} from './figma.types';

const FIGMA_AUTHORIZE_URL = 'https://www.figma.com/oauth';
const FIGMA_API_URL = 'https://api.figma.com/v1';
const FIGMA_SCOPE = 'file_metadata:read';
const FIGMA_STATE_PURPOSE = 'sign Figma OAuth state (HMAC)';
const FIGMA_STATE_TTL_MS = 5 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
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
  constructor(
    private readonly figmaRepository: FigmaRepository,
    private readonly projectsRepository: Pick<
      ProjectsRepository,
      'listAccessibleProjectIds'
    >
  ) {}

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

    await this.figmaRepository.createOAuthAttempt({
      projectId,
      userId: actorId,
      nonceHash: sha256(payload.nonce),
      codeVerifierEnc: encryptSecret(codeVerifier),
      expiresAt: new Date(payload.exp),
    });

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
    const { payload, codeVerifier } = await this.consumeState(state);
    await this.requireCanManageProject(payload.userId, payload.projectId);

    const tokens = await this.exchangeAuthorizationCode(code, codeVerifier);
    if (
      !tokens.access_token ||
      !tokens.refresh_token ||
      !tokens.user_id_string ||
      !tokens.expires_in
    ) {
      throw new Error('Figma token response was incomplete. Please try again.');
    }

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
    const connection =
      await this.figmaRepository.findFullConnectionByProjectId(projectId);
    if (!connection) {
      throw new Error('Figma connection not found. Connect Figma first.');
    }

    const accessToken = await this.getValidAccessToken(connection);
    const verification = await this.verifySavedDesign(
      accessToken,
      project.figma_url
    );
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

  private async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string
  ): Promise<FigmaOAuthTokenResponse> {
    const config = requireFigmaConfig();
    return this.requestToken('/oauth/token', config, {
      redirect_uri: config.redirectUri,
      code,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });
  }

  private async refreshAccessToken(
    connection: FigmaConnectionFull
  ): Promise<string> {
    const config = requireFigmaConfig();
    const tokens = await this.requestToken('/oauth/refresh', config, {
      refresh_token: decryptSecret(connection.refresh_token_enc),
    });
    if (!tokens.access_token || !tokens.expires_in) {
      throw new Error('Figma token refresh response was incomplete.');
    }
    const expiresAt = new Date(utcNow().getTime() + tokens.expires_in * 1000);
    await this.figmaRepository.updateTokens(connection.project_id, {
      accessTokenEnc: encryptSecret(tokens.access_token),
      accessTokenExpiresAt: expiresAt,
    });
    return tokens.access_token;
  }

  private async requestToken(
    path: string,
    config: FigmaConfig,
    fields: Record<string, string>
  ): Promise<FigmaOAuthTokenResponse> {
    const response = await fetch(`${FIGMA_API_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields),
    });
    const data = (await response.json()) as FigmaOAuthTokenResponse;
    if (!response.ok || data.error) {
      throw new Error(
        `Figma OAuth token request failed: ${data.message || data.error || response.statusText}`
      );
    }
    return data;
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

  private async verifySavedDesign(
    accessToken: string,
    figmaUrl: string | null
  ): Promise<FigmaVerificationFields> {
    if (!figmaUrl) {
      return {
        verifiedFileKey: null,
        verifiedFileName: null,
        verifiedAt: null,
        verificationError: null,
      };
    }
    const fileKey = figmaFileKeyFromUrl(figmaUrl);
    if (!fileKey) {
      return this.failedVerification(
        'The saved Figma link does not identify a supported design file.'
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `${FIGMA_API_URL}/files/${encodeURIComponent(fileKey)}/meta`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      return this.failedVerification(
        'Figma design access could not be verified. Try again.'
      );
    }
    let data: FigmaFileMetadataResponse = {};
    try {
      data = (await response.json()) as FigmaFileMetadataResponse;
    } catch {
      // Status-specific handling below still gives the useful result.
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return this.failedVerification(
          'The connected Figma account cannot access the saved design link.'
        );
      }
      if (response.status === 404) {
        return this.failedVerification('The saved Figma design was not found.');
      }
      return this.failedVerification(
        data.message || data.err || 'Figma design access could not be verified.'
      );
    }

    return {
      verifiedFileKey: fileKey,
      verifiedFileName: data.file?.name ?? null,
      verifiedAt: utcNow(),
      verificationError: null,
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
