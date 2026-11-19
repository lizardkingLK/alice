import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';

export type CorsConfigOptions = {
  /** Defaults to `process.env.FRONTEND_URL` or `http://localhost:3000`. */
  frontendUrl?: string;
};

export type CorsConfig = {
  isAllowedCorsOrigin: (origin: string | undefined) => boolean;
  corsMiddleware: RequestHandler;
};

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Browser CORS allowlist keyed off the configured frontend origin, with
 * localhost ↔ 127.0.0.1 loopback equivalence.
 */
export function createCorsConfig(options: CorsConfigOptions = {}): CorsConfig {
  const configuredOrigin =
    options.frontendUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const allowedOrigins = new Set<string>([configuredOrigin]);

  function isAllowedCorsOrigin(origin: string | undefined): boolean {
    if (!origin || allowedOrigins.has(origin)) {
      return true;
    }
    // Browser may use 127.0.0.1 while FRONTEND_URL is localhost (or the reverse).
    return isLoopbackOrigin(origin) && isLoopbackOrigin(configuredOrigin);
  }

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('error. blocked by CORS policy'));
    },
    optionsSuccessStatus: 200,
  };

  return {
    isAllowedCorsOrigin,
    corsMiddleware: cors(corsOptions),
  };
}
