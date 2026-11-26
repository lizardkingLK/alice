import { Router, type Response } from 'express';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { env } from '../../../config/env';
import { getRawBody } from '../../../lib/raw-body';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import type { GithubService } from './github.service';
import { ingestGithubWebhook } from './github-webhook.ingest';
import {
  GithubInsufficientScopeError,
  GithubReauthorizationRequiredError,
} from './github.types';

export type GithubRouterDeps = {
  githubService: GithubService;
};

type GithubDoneStatus = 'connected' | 'denied' | 'error';

function githubDoneBase(): string {
  return `${env.FRONTEND_URL.replace(/\/$/, '')}/integrations/github/done`;
}

function redirectGithubDone(
  res: Response,
  status: GithubDoneStatus,
  error?: string
) {
  const doneBase = githubDoneBase();
  if (status === 'denied') {
    const suffix = error
      ? `?github=denied&error=${encodeURIComponent(error)}`
      : '?github=denied';
    return res.redirect(`${doneBase}${suffix}`);
  }
  if (status === 'connected') {
    return res.redirect(`${doneBase}?github=connected`);
  }
  return res.redirect(`${doneBase}?github=error`);
}

function wantsAuthorizeRedirect(req: AuthenticatedRequest): boolean {
  return req.query.redirect === '1' || req.query.redirect === 'true';
}

async function respondWithAuthorizeUrl(
  req: AuthenticatedRequest,
  res: Response,
  getUrl: (userId: string) => Promise<{ url: string }>,
  errorLabel: string
) {
  try {
    const { url } = await getUrl(req.userId!);
    if (wantsAuthorizeRedirect(req)) {
      return res.redirect(url);
    }
    return res.json({ url });
  } catch (error) {
    const { status, error: message } = jsonErrorFromCaught(error, errorLabel);
    return res.status(status).json({ error: message });
  }
}

function respondGithubOauthRetired(res: Response, error: string) {
  return res.status(410).json({
    error,
    prefer: '/api/github/app/install/start',
    code: 'github_oauth_retired',
  });
}

export function createGithubRouter(deps: GithubRouterDeps) {
  const { githubService } = deps;
  const githubRouter: Router = Router();

  /**
   * GitHub App webhook receiver — HMAC verify + enqueue only (no sync apply).
   * Point the App **Webhook URL** at `/api/github/webhooks`.
   */
  githubRouter.post('/webhooks', async (req, res) => {
    const rawBody = getRawBody(req);
    if (!rawBody || rawBody.length === 0) {
      return res.status(400).json({ error: 'Missing raw request body' });
    }

    try {
      const outcome = await ingestGithubWebhook({
        rawBody,
        signatureHeader:
          typeof req.headers['x-hub-signature-256'] === 'string'
            ? req.headers['x-hub-signature-256']
            : undefined,
        deliveryId:
          typeof req.headers['x-github-delivery'] === 'string'
            ? req.headers['x-github-delivery']
            : undefined,
        event:
          typeof req.headers['x-github-event'] === 'string'
            ? req.headers['x-github-event']
            : undefined,
        body: req.body,
      });
      return res.status(outcome.status).json(outcome.body);
    } catch (error) {
      console.error('error. github webhook ingest failed:', error);
      return res.status(500).json({ error: 'Failed to enqueue webhook' });
    }
  });

  /** Phase 5: user OAuth connect retired — App install only. */
  githubRouter.get('/oauth/start', requireApiAuth, async (_req, res) =>
    respondGithubOauthRetired(
      res,
      'GitHub user OAuth connect is retired. Use GitHub App install instead.'
    )
  );

  githubRouter.get('/oauth/callback', async (_req, res) =>
    respondGithubOauthRetired(
      res,
      'GitHub user OAuth callback is retired. Use GitHub App install instead.'
    )
  );

  githubRouter.get(
    '/app/install/start',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) =>
      respondWithAuthorizeUrl(
        req,
        res,
        (userId) => githubService.startAppInstall(userId),
        'Failed to start GitHub App install'
      )
  );

  /**
   * Post-install redirect target. Point the GitHub App **Setup URL** here until
   * the web `/integrations/github/setup` page owns the flow.
   */
  githubRouter.get('/app/callback', async (req, res) => {
    const installationId =
      typeof req.query.installation_id === 'string'
        ? req.query.installation_id
        : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const setupAction =
      typeof req.query.setup_action === 'string' ? req.query.setup_action : '';

    if (setupAction === 'request') {
      return redirectGithubDone(res, 'denied', 'setup_request');
    }

    if (!installationId || !state) {
      return redirectGithubDone(res, 'error');
    }

    try {
      await githubService.handleAppInstallCallback(installationId, state);
      return redirectGithubDone(res, 'connected');
    } catch (error) {
      console.error('error. github app install callback failed:', error);
      return redirectGithubDone(res, 'error');
    }
  });

  githubRouter.get(
    '/connections',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const connections = await githubService.listConnections(req.userId!);
        return res.json({ connections });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to list GitHub connections'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  githubRouter.delete(
    '/connections/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Connection ID is required' });
      }

      try {
        await githubService.deleteConnection(req.userId!, id);
        return res.json({ success: true });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to delete GitHub connection'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  githubRouter.get(
    '/repositories',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const connectionId =
        typeof req.query.connectionId === 'string'
          ? req.query.connectionId
          : undefined;

      try {
        const repositories = await githubService.listRepositories(
          req.userId!,
          connectionId
        );
        return res.json({ repositories });
      } catch (error) {
        if (
          error instanceof GithubReauthorizationRequiredError ||
          error instanceof GithubInsufficientScopeError
        ) {
          return res.status(401).json({
            error: error.message,
            code: error.code,
            reauthorizationRequired: true,
          });
        }

        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to list GitHub repositories'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  return githubRouter;
}
