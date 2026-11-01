import type { Express } from 'express';
import detectPort from 'detect-port';

export type UseServerOptions = {
  /** Fallback when `process.env.PORT` is unset. */
  defaultPort: number;
  waitForPrisma: () => Promise<void>;
  /**
   * Socket inactivity / headers timeout budget (ms). Defaults to 120s for
   * long chat / tool rounds.
   */
  httpTimeoutMs?: number;
  /** Label in the critical init failure log. */
  initErrorLabel?: string;
};

/**
 * Listen locally; on Vercel the platform invokes the exported app directly.
 */
export function createUseServer(
  options: UseServerOptions
): (app: Express) => void {
  const {
    defaultPort,
    waitForPrisma,
    httpTimeoutMs = 120_000,
    initErrorLabel = 'server',
  } = options;

  const targetPort = Number.parseInt(
    process.env.PORT || String(defaultPort),
    10
  );

  async function reservePort() {
    try {
      const availablePort = await detectPort(targetPort);
      if (availablePort !== targetPort) {
        console.error(
          `error. port ${targetPort} is already in use. Stop the other process ` +
            `(often a stuck API from a previous Prisma hang) so the web app can reach this server.`
        );
        process.exit(1);
      }

      return targetPort;
    } catch (error) {
      console.error(
        `error. critical error during ${initErrorLabel} initialization:`,
        error
      );
      process.exit(1);
    }
  }

  async function startServer(app: Express) {
    const port = await reservePort();
    await waitForPrisma();
    const server = app.listen(port, () =>
      console.log(`info. listening on http://localhost:${port}`)
    );
    // Long POST handlers (chat tool rounds, bulk jobs) need a raised socket
    // inactivity timeout; Node's default (~15s) otherwise destroys the
    // connection and proxies surface a non-JSON 500.
    server.setTimeout(httpTimeoutMs);
    server.headersTimeout = httpTimeoutMs + 5_000;
  }

  return function useServer(app: Express): void {
    if (!process.env.VERCEL) {
      void startServer(app);
    }
  };
}
