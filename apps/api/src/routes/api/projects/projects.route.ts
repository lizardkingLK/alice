import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { projectsService } from './projects.service';
import { createProjectSchema, updateProjectSchema } from './projects.schemas';
import { parsePagination } from '../../../lib/pagination';

const projectsRouter: Router = Router();

projectsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const statusQuery = req.query.status as 'active' | 'archived' | undefined;
      const searchQuery = req.query.search as string | undefined;

      const pagination = parsePagination(req);
      if (pagination) {
        const { page, limit } = pagination;
        const result = await projectsService.listProjects(page, limit, statusQuery, searchQuery);
        const totalPages = Math.ceil(result.totalCount / limit);
        return res.json({
          projects: result.projects,
          totalCount: result.totalCount,
          page,
          limit,
          totalPages,
        });
      }

      const projects = await projectsService.listProjects();
      res.json({ projects });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list projects';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const project = await projectsService.createProject(
        req.userId!,
        {
          name: parsed.data.name,
          key: parsed.data.key,
          description: parsed.data.description ?? null,
          owner_id: parsed.data.owner_id,
          start_date: parsed.data.start_date ?? null,
          end_date: parsed.data.end_date ?? null,
          status: parsed.data.status ?? 'active',
        }
      );
      res.status(201).json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.put(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const project = await projectsService.updateProject(
        req.userId!,
        id,
        parsed.data
      );
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.patch(
  '/:id/soft-delete',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      const project = await projectsService.softDeleteProject(
        req.userId!,
        id
      );
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to soft delete project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.patch(
  '/:id/restore',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      const project = await projectsService.restoreProject(
        req.userId!,
        id
      );
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.delete(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      await projectsService.hardDeleteProject(req.userId!, id);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to hard delete project';
      res.status(500).json({ error: message });
    }
  }
);

export default projectsRouter;
