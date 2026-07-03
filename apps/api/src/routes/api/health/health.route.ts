import { Request, Response, Router } from 'express';

const healthRouter: Router = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', runtime: 'express' });
});

export default healthRouter;
