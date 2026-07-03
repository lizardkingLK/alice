import './config/load-env';
import './config/preload';

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

const listen = (port: number) =>
  app.listen(port, () =>
    console.log(`info. listening on http://localhost:${port}`)
  );
startServer().then(listen);
