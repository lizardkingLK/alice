import { Request, Response } from 'express';
import { Router } from 'express';

const healthRouter: Router = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', runtime: 'express' });
});

export default healthRouter;
