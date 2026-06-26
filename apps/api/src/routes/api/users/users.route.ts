import { Request, Response, Router } from 'express';
import { requireApiAuth } from '../../../middlewares/auth';

const usersRouter: Router = Router();

usersRouter.get('/secure', requireApiAuth, (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to your private dashboard!' });
});

export default usersRouter;
