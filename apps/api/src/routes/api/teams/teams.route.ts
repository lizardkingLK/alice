import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { teamsService } from './teams.service';
import { createTeamSchema, updateTeamSchema } from './teams.schemas';
import { parsePagination } from '../../../lib/pagination';

const teamsRouter: Router = Router();

teamsRouter.get('/', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const statusValue = req.query.status as
      'active' | 'inactive' | 'archived' | 'deleted' | undefined;
    const searchStr = req.query.search as string | undefined;

    const paginationInfo = parsePagination(req);
    if (paginationInfo) {
      const { page: targetPage, limit: targetLimit } = paginationInfo;
      const listResult = await teamsService.listTeams(
        targetPage,
        targetLimit,
        statusValue,
        searchStr
      );
      const pagesCount = Math.ceil(listResult.totalCount / targetLimit);
      return res.json({
        teams: listResult.teams,
        totalCount: listResult.totalCount,
        page: targetPage,
        limit: targetLimit,
        totalPages: pagesCount,
      });
    }

    const allTeams = await teamsService.listTeams();
    res.json({ teams: allTeams });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve teams';
    res.status(500).json({ error: message });
  }
});

teamsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const validation = createTeamSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = z.treeifyError(validation.error);
      return res.status(400).json({ error: errorMsg });
    }

    try {
      const createdRecord = await teamsService.createTeam(req.userId!, {
        name: validation.data.name,
        description: validation.data.description ?? null,
        manager_id: validation.data.manager_id,
        tech_stack: validation.data.tech_stack ?? null,
        status: validation.data.status ?? 'active',
        member_ids: validation.data.member_ids,
      });
      res.status(201).json({ team: createdRecord });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to register team';
      res.status(500).json({ error: message });
    }
  }
);

teamsRouter.put(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const teamIdParam = req.params.id;
    if (!teamIdParam) {
      return res.status(400).json({ error: 'Team identifier is required' });
    }

    const validation = updateTeamSchema.safeParse(req.body);
    if (validation.success === false) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }

    try {
      const updatedRecord = await teamsService.updateTeam(
        req.userId!,
        teamIdParam,
        validation.data
      );
      res.json({ team: updatedRecord });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to modify team';
      res.status(500).json({ error: message });
    }
  }
);

teamsRouter.patch(
  '/:id/soft-delete',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const teamIdParam = req.params.id;
    if (!teamIdParam) {
      return res.status(400).json({ error: 'Team identifier is required' });
    }

    try {
      const archivedRecord = await teamsService.softDeleteTeam(
        req.userId!,
        teamIdParam
      );
      res.json({ team: archivedRecord });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to archive team';
      res.status(500).json({ error: message });
    }
  }
);

teamsRouter.patch(
  '/:id/restore',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const teamIdParam = req.params.id;
    if (!teamIdParam) {
      return res.status(400).json({ error: 'Team identifier is required' });
    }

    try {
      const restoredRecord = await teamsService.restoreTeam(
        req.userId!,
        teamIdParam
      );
      res.json({ team: restoredRecord });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore team';
      res.status(500).json({ error: message });
    }
  }
);

teamsRouter.delete(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const teamIdParam = req.params.id;
    if (!teamIdParam) {
      return res.status(400).json({ error: 'Team identifier is required' });
    }

    try {
      await teamsService.hardDeleteTeam(req.userId!, teamIdParam);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to permanently purge team';
      res.status(500).json({ error: message });
    }
  }
);

export default teamsRouter;
