import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { usersService } from './users.service';
import { createUserSchema, updateUserSchema } from './users.schemas';

const usersRouter: Router = Router();

usersRouter.get('/secure', requireApiAuth, (_req, res) => {
  res.json({ message: 'Welcome to your private dashboard!' });
});

usersRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const pageQuery = req.query.page;
      const limitQuery = req.query.limit;

      if (pageQuery !== undefined && limitQuery !== undefined) {
        const page = Number.parseInt(pageQuery as string, 10);
        const limit = Number.parseInt(limitQuery as string, 10);

        if (!Number.isNaN(page) && page > 0 && !Number.isNaN(limit) && limit > 0) {
          const result = await usersService.listUsers(req.userId!, page, limit);
          const totalPages = Math.ceil(result.totalCount / limit);
          return res.json({
            users: result.users,
            totalCount: result.totalCount,
            page,
            limit,
            totalPages,
          });
        }
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
    const bodySchema = updateUserSchema.omit({ id: true });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const user = await usersService.updateUser(
        req.userId!,
        req.params.id!,
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
        req.params.id!,
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
