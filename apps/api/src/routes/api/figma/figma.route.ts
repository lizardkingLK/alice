import { Router } from 'express';
import { env } from '../../../config/env';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import type { FigmaService } from './figma.service';

export function createFigmaRouter(deps: { figmaService: FigmaService }) {
  const router: Router = Router();

  router.post(
    '/projects/:projectId/oauth/start',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await deps.figmaService.startOAuth(
          req.userId!,
          req.params.projectId!
        );
        return res.json(result);
      } catch (error) {
        const result = jsonErrorFromCaught(
          error,
          'Failed to start Figma OAuth'
        );
        return res.status(result.status).json({ error: result.error });
      }
    }
  );

  router.get('/oauth/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError =
      typeof req.query.error === 'string' ? req.query.error : '';
    const doneBase = `${env.FRONTEND_URL.replace(/\/$/, '')}/integrations/figma/done`;

    if (oauthError) {
      if (!state) {
        return res.redirect(
          `${doneBase}?figma=error&error=${encodeURIComponent('Invalid or missing OAuth state.')}`
        );
      }
      try {
        await deps.figmaService.handleOAuthDenial(state);
        return res.redirect(
          `${doneBase}?figma=denied&error=${encodeURIComponent(oauthError)}`
        );
      } catch (error) {
        const result = jsonErrorFromCaught(
          error,
          'Invalid or missing OAuth state.'
        );
        return res.redirect(
          `${doneBase}?figma=error&error=${encodeURIComponent(result.error)}`
        );
      }
    }

    if (!code || !state) {
      return res.redirect(
        `${doneBase}?figma=error&error=${encodeURIComponent('Missing OAuth callback parameters.')}`
      );
    }

    try {
      await deps.figmaService.handleOAuthCallback(code, state);
      return res.redirect(`${doneBase}?figma=connected`);
    } catch (error) {
      console.error('error. figma oauth callback failed:', error);
      const result = jsonErrorFromCaught(error, 'Figma OAuth failed');
      return res.redirect(
        `${doneBase}?figma=error&error=${encodeURIComponent(result.error)}`
      );
    }
  });

  router.get(
    '/projects/:projectId/connection',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const connection = await deps.figmaService.getConnectionStatus(
          req.userId!,
          req.params.projectId!
        );
        return res.json({ connection });
      } catch (error) {
        const result = jsonErrorFromCaught(
          error,
          'Failed to load Figma connection'
        );
        return res.status(result.status).json({ error: result.error });
      }
    }
  );

  router.post(
    '/projects/:projectId/verify',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const connection = await deps.figmaService.verifyCurrentDesign(
          req.userId!,
          req.params.projectId!
        );
        return res.json({ connection });
      } catch (error) {
        const result = jsonErrorFromCaught(
          error,
          'Failed to verify Figma design access'
        );
        return res.status(result.status).json({ error: result.error });
      }
    }
  );

  router.delete(
    '/projects/:projectId/connection',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deps.figmaService.disconnect(req.userId!, req.params.projectId!);
        return res.json({ success: true });
      } catch (error) {
        const result = jsonErrorFromCaught(error, 'Failed to disconnect Figma');
        return res.status(result.status).json({ error: result.error });
      }
    }
  );

  return router;
}
