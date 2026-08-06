import './config/load-env';
import './config/env';

import express, { type Express } from 'express';

import useServer from './config/server';
import securityConfig from './config/security';
import corsConfig from './config/cors';
import routesConfig from './config/routing';
import jsonConfig from './config/json';
import errorConfig from './middlewares/errors';

const app: Express = express();
securityConfig(app);

app.use(corsConfig);
app.use(jsonConfig);
app.use(routesConfig);

app.use(errorConfig);
useServer(app);

export default app;
