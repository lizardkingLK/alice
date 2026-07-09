import { Router } from 'express';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { attributesService } from './attributes.service';

const attributesRouter: Router = Router();

attributesRouter.get(
  '/',
  requireApiAuth,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const attributes = await attributesService.listAttributes();
      res.json({ attributes });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list attributes';
      res.status(500).json({ error: message });
    }
  }
);

export default attributesRouter;
