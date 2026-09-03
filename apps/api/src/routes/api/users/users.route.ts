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
import { listUsersQuerySchema } from '@repo/types';

export type UsersRouterDeps = {
  usersService: UsersService;
};

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function listUsersQueryFromRequest(query: Record<string, unknown>) {
  return listUsersQuerySchema.safeParse({
    page: firstQueryValue(query.page),
    limit: firstQueryValue(query.limit),
    search: firstQueryValue(query.search),
    role: firstQueryValue(query.role),
    active: firstQueryValue(query.active),
  });
}

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

  usersRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listUsersQueryFromRequest(
        req.query as Record<string, unknown>
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const result = await usersService.listUsersPaginated(parsed.data);
        res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to list users';
        res.status(500).json({ error: message });
      }
    }
  );

  usersRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: 'Invalid user ID.' });
      }

      try {
        const user = await usersService.getUserDetail(parsedId.data);
        if (!user) {
          return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to get user';
        res.status(500).json({ error: message });
      }
    }
  );

  return usersRouter;
}
