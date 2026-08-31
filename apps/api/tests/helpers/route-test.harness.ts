import express, { type Router } from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

/** Spin up a throwaway Express app with one mounted router for HTTP integration tests. */
export async function withMountedRouter(
  mountPath: string,
  router: Router,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(mountPath, router);

  const server: Server = await new Promise((resolve) => {
    const next = app.listen(0, '127.0.0.1', () => resolve(next));
  });

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
