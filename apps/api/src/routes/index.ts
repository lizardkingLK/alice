import { Router } from 'express';
import { env } from '../config/env';

const API_STATUS_MESSAGE = `api server is listening on port ${env.PORT}...`;

export function createRootRouter(): Router {
  const rootRouter: Router = Router();

  rootRouter.get('/', (_req, res) => {
    res.status(200).send(API_STATUS_MESSAGE);
  });

  return rootRouter;
}
