/**
 * Build the API App-install callback URL from the GitHub Setup URL query
 * string (`installation_id`, `state`, `setup_action`, …).
 */
export function buildGithubAppCallbackUrl(
  search: string | URLSearchParams,
  apiBaseUrl: string
): string {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  const base = apiBaseUrl.replace(/\/$/, '');
  const query = params.toString();
  return query
    ? `${base}/api/github/app/callback?${query}`
    : `${base}/api/github/app/callback`;
}

export function resolvePublicApiBaseUrl(
  envValue = process.env.NEXT_PUBLIC_API_URL
): string | null {
  const trimmed = envValue?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, '');
}
