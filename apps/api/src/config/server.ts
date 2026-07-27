import type { Express } from 'express';
import detectPort from 'detect-port';

const TARGET_PORT = Number.parseInt(process.env.PORT || '3001', 10);

async function reservePort() {
  try {
    const availablePort = await detectPort(TARGET_PORT);
    if (availablePort !== TARGET_PORT) {
      console.warn(
        `warn. target port ${TARGET_PORT} was occupied. shifting to ${availablePort}.`
      );
    }

    return availablePort;
  } catch (error) {
    console.error('error. critical error during API initialization:', error);
    process.exit(1);
  }
}

export default async function startServer(app: Express) {
  const port = await reservePort();
  app.listen(port, () =>
    console.log(`info. listening on http://localhost:${port}`)
  );
}
