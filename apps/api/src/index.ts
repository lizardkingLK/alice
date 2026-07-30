import './config/load-env';
import './config/env';

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

import startServer from './config/server';
import corsConfig from './config/cors';
import routesConfig from './config/routing';
import jsonConfig from './config/json';

const app: Express = express();
app.disable('x-powered-by');

app.use(corsConfig);
app.use(jsonConfig);
app.use(routesConfig);

// Defensive JSON/body error handling. Some platforms return 413 before this
// middleware runs, but when Express body parsing throws we still want a
// consistent JSON response (and correct CORS headers).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }

  const errAny = err as { status?: number; statusCode?: number; name?: string };
  const status =
    errAny.status ??
    errAny.statusCode ??
    (typeof res.statusCode === 'number' ? res.statusCode : undefined);

  const message = err instanceof Error ? err.message : 'Request failed';

  const isPayloadTooLarge =
    status === 413 ||
    errAny.name === 'PayloadTooLargeError' ||
    /payload too large/i.test(message);

  if (isPayloadTooLarge) {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }

  console.error('error. api request failed:', message);
  res
    .status(typeof status === 'number' && status >= 400 ? status : 500)
    .json({ error: message });
});

// Vercel provides the HTTP server; only listen in local / non-serverless runs.
if (!process.env.VERCEL) {
  void startServer(app);
}

export default app;
