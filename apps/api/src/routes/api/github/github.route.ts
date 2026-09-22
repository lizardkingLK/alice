import { Router } from 'express';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { env } from '../../../config/env';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import type { GithubService } from './github.service';
import {
  GithubInsufficientScopeError,
  GithubReauthorizationRequiredError,
} from './github.types';

export type GithubRouterDeps = {
  githubService: GithubService;
};

export function createGithubRouter(deps: GithubRouterDeps) {
  const { githubService } = deps;
  const githubRouter: Router = Router();

  githubRouter.get(
    '/oauth/start',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { url } = await githubService.startOAuth(req.userId!);
        if (req.query.redirect === '1' || req.query.redirect === 'true') {
          return res.redirect(url);
        }
        return res.json({ url });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to start GitHub OAuth'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  githubRouter.get('/oauth/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError =
      typeof req.query.error === 'string' ? req.query.error : '';

    const frontendBase = env.FRONTEND_URL.replace(/\/$/, '');
    const doneBase = `${frontendBase}/integrations/github/done`;

    if (oauthError) {
      return res.redirect(
        `${doneBase}?github=denied&error=${encodeURIComponent(oauthError)}`
      );
    }

    if (!code || !state) {
      return res.redirect(`${doneBase}?github=error`);
    }

    try {
      await githubService.handleOAuthCallback(code, state);
      return res.redirect(`${doneBase}?github=connected`);
    } catch (error) {
      console.error('error. github oauth callback failed:', error);
      return res.redirect(`${doneBase}?github=error`);
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
