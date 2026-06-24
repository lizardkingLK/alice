import { Router } from "express";

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
    res.json({ status: 'ok', runtime: 'express' });
});

export default healthRouter;