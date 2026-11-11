const HEADER_WHITESPACE = /[\r\n\t]+/g;

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeEmailDisplayText(
  value: string,
  fallback: string,
  maxLength = 160
): string {
  const normalized = value
    .replace(HEADER_WHITESPACE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, maxLength);
}

export function normalizeEmailAddress(value: string): string {
  const normalized = value.trim();
  const atIndex = normalized.indexOf('@');
  const dotIndex = normalized.lastIndexOf('.');
  const hasWhitespace = /\s/.test(normalized);
  if (
    !normalized ||
    hasWhitespace ||
    atIndex <= 0 ||
    atIndex !== normalized.lastIndexOf('@') ||
    dotIndex <= atIndex + 1 ||
    dotIndex === normalized.length - 1
  ) {
    throw new Error('Recipient email is invalid.');
  }
  return normalized;
}

export function buildValidatedFrontendUrl(
  frontendUrl: string,
  pathSegments: readonly string[]
): string {
  let configuredUrl: URL;
  try {
    configuredUrl = new URL(frontendUrl);
  } catch {
    throw new Error('Alice frontend URL is invalid.');
  }

  if (!['http:', 'https:'].includes(configuredUrl.protocol)) {
    throw new Error('Alice frontend URL must use HTTP or HTTPS.');
  }
  const localHttpHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    configuredUrl.protocol === 'http:' &&
    !localHttpHosts.has(configuredUrl.hostname)
  ) {
    throw new Error(
      'Alice frontend URL must use HTTPS outside local development.'
    );
  }
  if (configuredUrl.username || configuredUrl.password) {
    throw new Error('Alice frontend URL must not contain credentials.');
  }

  const path = pathSegments.map(encodeURIComponent).join('/');
  return new URL(`/${path}`, configuredUrl.origin).toString();
}
