import { Router } from 'express';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { env } from '../../../config/env';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import type { JiraService } from './jira.service';

export type JiraRouterDeps = {
  jiraService: JiraService;
};

export function createJiraRouter(deps: JiraRouterDeps) {
  const { jiraService } = deps;
  const jiraRouter: Router = Router();

  jiraRouter.get(
    '/oauth/start',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { url } = await jiraService.startOAuth(req.userId!);
        if (req.query.redirect === '1' || req.query.redirect === 'true') {
          return res.redirect(url);
        }
        return res.json({ url });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to start Jira OAuth'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  jiraRouter.get('/oauth/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError =
      typeof req.query.error === 'string' ? req.query.error : '';

    const frontendBase = env.FRONTEND_URL.replace(/\/$/, '');
    // Dedicated done page so OAuth opened in a new tab does not replace
    // /projects (or a create-project modal) in the original window.
    const doneBase = `${frontendBase}/integrations/jira/done`;

    if (oauthError) {
      return res.redirect(
        `${doneBase}?jira=denied&error=${encodeURIComponent(oauthError)}`
      );
    }

    if (!code || !state) {
      return res.redirect(`${doneBase}?jira=error`);
    }

    try {
      await jiraService.handleOAuthCallback(code, state);
      return res.redirect(`${doneBase}?jira=connected`);
    } catch (error) {
      console.error('error. jira oauth callback failed:', error);
      return res.redirect(`${doneBase}?jira=error`);
    }
  });

  jiraRouter.get(
    '/connections',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const connections = await jiraService.listConnections(req.userId!);
        return res.json({ connections });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to list Jira connections'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  jiraRouter.delete(
    '/connections/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Connection ID is required' });
      }

      try {
        await jiraService.deleteConnection(req.userId!, id);
        return res.json({ success: true });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to delete Jira connection'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  jiraRouter.get(
    '/connections/:id/projects',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Connection ID is required' });
      }

      try {
        const projects = await jiraService.listJiraProjects(req.userId!, id);
        return res.json({ projects });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to list Jira projects'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  return jiraRouter;
}
