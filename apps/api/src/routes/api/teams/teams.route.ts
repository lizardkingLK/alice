import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { teamsService } from './teams.service';
import {
  createTeamSchema,
  teamLockActionSchema,
  updateTeamMemberSchema,
  updateTeamSchema,
} from './teams.schemas';
import {
  sendRouteMutationError,
  runLockedStatusRoute,
} from '../../../lib/optimistic-lock';
import { parsePagination } from '../../../lib/pagination';

const teamsRouter: Router = Router();

type TeamLockAction = (
  actorId: string,
  teamId: string,
  expectedUpdatedAt: string
) => Promise<unknown>;

async function handleTeamLockAction(
  req: AuthenticatedRequest,
  res: Response,
  action: TeamLockAction,
  failureMessage: string
) {
  await runLockedStatusRoute({
    res,
    actorId: req.userId!,
    id: req.params.id,
    missingIdMessage: 'Team identifier is required',
    parseBody: () => teamLockActionSchema.safeParse(req.body),
    treeifyError: (error) => z.treeifyError(error as z.ZodError),
    action,
    toResponseBody: (team) => ({ team }),
    failureMessage,
  });
}

teamsRouter.get('/', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const statusValue = req.query.status as
      'active' | 'inactive' | 'archived' | 'deleted' | undefined;
    const searchStr = req.query.search as string | undefined;
    const projectId = req.query.project_id as string | undefined;

    const paginationInfo = parsePagination(req);
    if (paginationInfo) {
      const { page: targetPage, limit: targetLimit } = paginationInfo;
      const listResult = await teamsService.listTeams(
        targetPage,
        targetLimit,
        statusValue,
        searchStr,
        projectId
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
        project_id: validation.data.project_id,
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
      const { expectedUpdatedAt, ...input } = validation.data;
      const updatedRecord = await teamsService.updateTeam(
        req.userId!,
        teamIdParam,
        input,
        expectedUpdatedAt
      );
      res.json({ team: updatedRecord });
    } catch (error) {
      sendRouteMutationError(res, error, 'Failed to modify team');
    }
  }
);

function registerTeamLockAction(
  path: '/:id/soft-delete' | '/:id/restore',
  action: TeamLockAction,
  failureMessage: string
) {
  teamsRouter.patch(
    path,
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      await handleTeamLockAction(req, res, action, failureMessage);
    }
  );
}

registerTeamLockAction(
  '/:id/soft-delete',
  (actorId, teamId, expectedUpdatedAt) =>
    teamsService.softDeleteTeam(actorId, teamId, expectedUpdatedAt),
  'Failed to archive team'
);

registerTeamLockAction(
  '/:id/restore',
  (actorId, teamId, expectedUpdatedAt) =>
    teamsService.restoreTeam(actorId, teamId, expectedUpdatedAt),
  'Failed to restore team'
);

teamsRouter.patch(
  '/:teamId/members/:userId',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { teamId, userId } = req.params;
    if (!teamId || !userId) {
      return res
        .status(400)
        .json({ error: 'Team and user identifiers are required' });
    }

    const validation = updateTeamMemberSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }

    try {
      const { expectedUpdatedAt, ...patch } = validation.data;
      await teamsService.updateTeamMember(
        teamId,
        userId,
        patch,
        req.userId!,
        expectedUpdatedAt
      );
      res.json({ success: true });
    } catch (error) {
      sendRouteMutationError(res, error, 'Failed to update team member');
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
