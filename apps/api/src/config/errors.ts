import type { ErrorRequestHandler } from 'express';

/**
 * Defensive JSON/body error handling. Some platforms return 413 before this
 * middleware runs, but when Express body parsing throws we still want a
 * consistent JSON response (and correct CORS headers).
 */
const errorConfig: ErrorRequestHandler = (err, _req, res, _next) => {
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
};

export default errorConfig;
