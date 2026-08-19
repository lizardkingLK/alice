import type { Express } from 'express';
import detectPort from 'detect-port';
import { waitForPrisma } from '../lib/prisma';

const TARGET_PORT = Number.parseInt(process.env.PORT || '3001', 10);

async function reservePort() {
  try {
    const availablePort = await detectPort(TARGET_PORT);
    if (availablePort !== TARGET_PORT) {
      console.error(
        `error. port ${TARGET_PORT} is already in use. Stop the other process ` +
          `(often a stuck API from a previous Prisma hang) so the web app can reach this server.`
      );
      process.exit(1);
    }

    return TARGET_PORT;
  } catch (error) {
    console.error('error. critical error during API initialization:', error);
    process.exit(1);
  }
}

async function startServer(app: Express) {
  const port = await reservePort();
  await waitForPrisma();
  const server = app.listen(port, () =>
    console.log(`info. listening on http://localhost:${port}`)
  );
  // Chat POST waits on Gemini + up to 5 tool rounds. Node's socket inactivity
  // timeout would otherwise destroy the connection (~15s) and Next's rewrite
  // surfaces that as a non-JSON 500 → "Could not connect to the backend."
  const httpTimeoutMs = 120_000;
  server.setTimeout(httpTimeoutMs);
  server.headersTimeout = httpTimeoutMs + 5_000;
}

/** Listen locally; on Vercel the platform invokes the exported app directly. */
export default function useServer(app: Express): void {
  if (!process.env.VERCEL) {
    void startServer(app);
  }
}
