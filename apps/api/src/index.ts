import './config/load-env';
import './config/env';

import express from 'express';

import startServer from './config/server';
import corsConfig from './config/cors';
import routesConfig from './config/routing';
import jsonConfig from './config/json';

const app = express();
app.disable('x-powered-by');

app.use(corsConfig);
app.use(jsonConfig);
app.use(routesConfig);

// Vercel provides the HTTP server; only listen in local / non-serverless runs.
if (!process.env.VERCEL) {
  void startServer(app);
}

export default app;
