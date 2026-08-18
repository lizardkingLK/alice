import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/config/env', () => ({
  env: { PORT: 5000 },
}));

import { createRootRouter } from '../../src/routes';

async function withRootApp(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use('/', createRootRouter());

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

describe('root status route', () => {
  it('returns a plain listening message at GET /', async () => {
    await withRootApp(async (baseUrl) => {
      const response = await fetch(baseUrl);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toBe('api server is listening on port 5000...');
    });
  });
});
