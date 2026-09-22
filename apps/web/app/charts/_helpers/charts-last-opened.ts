/** Cookie for last-opened chart workspace id (no board JSON). */
export const CHARTS_LAST_OPENED_COOKIE = 'alice_charts_last_opened_v1';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readChartsLastOpenedId(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CHARTS_LAST_OPENED_COOKIE}=`));
  if (!match) {
    return null;
  }
  const value = decodeURIComponent(
    match.slice(CHARTS_LAST_OPENED_COOKIE.length + 1)
  );
  return UUID_RE.test(value) ? value : null;
}

export function writeChartsLastOpenedId(chartId: string): void {
  if (typeof document === 'undefined' || !UUID_RE.test(chartId)) {
    return;
  }
  document.cookie = [
    `${CHARTS_LAST_OPENED_COOKIE}=${encodeURIComponent(chartId)}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
}

export function clearChartsLastOpenedId(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = [
    `${CHARTS_LAST_OPENED_COOKIE}=`,
    'path=/',
    'max-age=0',
    'SameSite=Lax',
  ].join('; ');
}
