import { Router } from 'express';
import { requireApiAuth, type AuthenticatedRequest } from '../../../middlewares/auth';
import { projectsService } from './projects.service';

const projectsRouter: Router = Router();

projectsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const projects = await projectsService.listProjects();
      res.json({ projects });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list projects';
      res.status(500).json({ error: message });
    }
  }
);

export default projectsRouter;
