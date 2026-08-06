import './config/load-env';
import './config/env';

import express, { type Express } from 'express';

import useServer from './config/server';
import corsConfig from './config/cors';
import routesConfig from './config/routing';
import jsonConfig from './config/json';
import errorConfig from './config/errors';
import poweredBy from './config/security';

const app: Express = express();

app.disable(poweredBy);
app.use(corsConfig);
app.use(jsonConfig);
app.use(routesConfig);

app.use(errorConfig);
useServer(app);

export default app;
