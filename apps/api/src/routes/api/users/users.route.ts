import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { UsersService, isUsersServiceError } from './users.service';
import {
  createUserSchema,
  toggleUserActiveSchema,
  updateUserSchema,
} from './users.schemas';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';

export type UsersRouterDeps = {
  usersService: UsersService;
};

export function createUsersRouter(deps: UsersRouterDeps) {
  const { usersService } = deps;
  const usersRouter: Router = Router();

  usersRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const bodySchema = createUserSchema.extend({
        redirectTo: z.string(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const user = await usersService.createUser(req.userId!, parsed.data);
        res.status(201).json({ user });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create user';
        res.status(500).json({ error: message });
      }
    }
  );

  usersRouter.put(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const bodySchema = updateUserSchema.omit({ id: true });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const { expectedUpdatedAt, ...input } = parsed.data;
        const user = await usersService.updateUser(
          req.userId!,
          id,
          input,
          expectedUpdatedAt
        );
        res.json({ user });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error ? error.message : 'Failed to update user';
        res.status(500).json({ error: message });
      }
    }
  );

  usersRouter.patch(
    '/:id/toggle-active',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const parsed = toggleUserActiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const user = await usersService.toggleUserActive(
          req.userId!,
          id,
          parsed.data.active,
          parsed.data.expectedUpdatedAt
        );
        res.json({ user });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        if (isUsersServiceError(error)) {
          return res.status(error.status).json({ error: error.message });
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update user active status';

        if (message.includes('Cannot deactivate the last active admin')) {
          return res.status(403).json({ error: message });
        }

        res.status(500).json({ error: message });
      }
    }
  );

  return usersRouter;
}
