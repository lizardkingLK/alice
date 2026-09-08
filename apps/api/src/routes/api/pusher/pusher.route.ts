import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { PusherService, isPusherServiceError } from './pusher.service';

const pusherAuthBodySchema = z.object({
  socket_id: z.string().min(1),
  channel_name: z.string().min(1),
});

export type PusherRouterDeps = {
  pusherService: PusherService;
};

export function createPusherRouter(deps: PusherRouterDeps) {
  const { pusherService } = deps;
  const pusherRouter: Router = Router();

  pusherRouter.post(
    '/auth',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = pusherAuthBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const authorization = await pusherService.authorizePresenceChannel(
          req.userId!,
          parsed.data.socket_id,
          parsed.data.channel_name
        );
        res.json(authorization);
      } catch (error) {
        if (isPusherServiceError(error)) {
          return res.status(error.status).json({ error: error.message });
        }

        console.error('error. pusher authorization failed');
        res.status(500).json({ error: 'Failed to authorize Pusher channel.' });
      }
    }
  );

  return pusherRouter;
}
