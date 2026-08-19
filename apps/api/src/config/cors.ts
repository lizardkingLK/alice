import cors from 'cors';

const configuredOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';

const allowedOrigins = new Set<string>([configuredOrigin]);

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.has(origin)) {
    return true;
  }
  // Browser may use 127.0.0.1 while FRONTEND_URL is localhost (or the reverse).
  return isLoopbackOrigin(origin) && isLoopbackOrigin(configuredOrigin);
}

const corsConfig = cors({
  origin: (origin, callback) => {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('error. blocked by CORS policy'));
  },
  optionsSuccessStatus: 200,
});

export default corsConfig;
