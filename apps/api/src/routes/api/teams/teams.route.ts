import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { TeamsService } from './teams.service';
import {
  createTeamSchema,
  teamLockActionSchema,
  updateTeamMemberSchema,
  updateTeamSchema,
} from './teams.schemas';
import {
  sendRouteMutationError,
  registerLockedStatusPatch,
} from '../../../lib/optimistic-lock';

export type TeamsRouterDeps = {
  teamsService: TeamsService;
};

export function createTeamsRouter(deps: TeamsRouterDeps) {
  const { teamsService } = deps;
  const teamsRouter: Router = Router();

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
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
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

  registerLockedStatusPatch({
    router: teamsRouter,
    path: '/:id/soft-delete',
    auth: requireApiAuth,
    missingIdMessage: 'Team identifier is required',
    parseBody: (req) => teamLockActionSchema.safeParse(req.body),
    treeifyError: (error) => z.treeifyError(error as z.ZodError),
    action: (actorId, teamId, expectedUpdatedAt) =>
      teamsService.softDeleteTeam(actorId, teamId, expectedUpdatedAt),
    toResponseBody: (team) => ({ team }),
    failureMessage: 'Failed to archive team',
  });

  registerLockedStatusPatch({
    router: teamsRouter,
    path: '/:id/restore',
    auth: requireApiAuth,
    missingIdMessage: 'Team identifier is required',
    parseBody: (req) => teamLockActionSchema.safeParse(req.body),
    treeifyError: (error) => z.treeifyError(error as z.ZodError),
    action: (actorId, teamId, expectedUpdatedAt) =>
      teamsService.restoreTeam(actorId, teamId, expectedUpdatedAt),
    toResponseBody: (team) => ({ team }),
    failureMessage: 'Failed to restore team',
  });

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
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
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

  return teamsRouter;
}
