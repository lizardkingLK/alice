import { Router } from 'express';
import { root } from './composition';

const routesConfig: Router = Router();

routesConfig.use('/', root.router);

export default routesConfig;
