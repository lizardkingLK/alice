import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { usersService } from './users.service';
import { createUserSchema, updateUserSchema } from './users.schemas';
import { parsePagination } from '../../../lib/pagination';

const usersRouter: Router = Router();

usersRouter.get('/secure', requireApiAuth, (_req, res) => {
  res.json({ message: 'Welcome to your private dashboard!' });
});

usersRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const paginatedParams = parsePagination(req);
      if (paginatedParams) {
        const p = paginatedParams.page;
        const l = paginatedParams.limit;
        const paginatedResult = await usersService.listUsers(req.userId!, p, l);
        return res.json({
          users: paginatedResult.users,
          totalCount: paginatedResult.totalCount,
          page: p,
          limit: l,
          totalPages: Math.ceil(paginatedResult.totalCount / l),
        });
      }

      const users = await usersService.listUsers(req.userId!);
      res.json({ users });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list users';
      res.status(500).json({ error: message });
    }
  }
);

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
      const user = await usersService.updateUser(
        req.userId!,
        id,
        parsed.data
      );
      res.json({ user });
    } catch (error) {
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

    const toggleSchema = z.object({
      active: z.boolean(),
    });
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const user = await usersService.toggleUserActive(
        req.userId!,
        id,
        parsed.data.active
      );
      res.json({ user });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update user active status';
      res.status(500).json({ error: message });
    }
  }
);

export default usersRouter;
