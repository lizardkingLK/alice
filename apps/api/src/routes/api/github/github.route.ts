import { Router, type Response } from 'express';
import { requireApiAuth, type AuthenticatedRequest } from '../../../middlewares/auth';
import { GitHubService } from './github.service';
import { githubSettingsSchema } from './github.schemas';

export function createGitHubRouter({ githubService }: { githubService: GitHubService }): Router {
  const router = Router();

  router.get(
    '/settings/:projectId',
    requireApiAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({ data: null, error: 'Project ID is required' });
      }

      try {
        const settings = await githubService.getSettings(projectId);
        res.json({ data: settings, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to retrieve GitHub settings';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  router.put(
    '/settings/:projectId',
    requireApiAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({ data: null, error: 'Project ID is required' });
      }

      const parsed = githubSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ data: null, error: parsed.error.message });
      }

      try {
        const settings = await githubService.saveSettings(projectId, parsed.data);
        res.json({ data: settings, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save GitHub settings';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  router.get(
    '/work-items/:workItemId/development',
    requireApiAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const { workItemId } = req.params;
      if (!workItemId) {
        return res.status(400).json({ data: null, error: 'Work Item ID is required' });
      }

      try {
        const devInfo = await githubService.getWorkItemDevelopment(workItemId);
        res.json({ data: devInfo, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch work item development info';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  return router;
}
