/**
 * Strip integration secrets from project rows before they reach the browser.
 * Re-exports the shared `@repo/types` helper for RSC / cache import paths.
 */
export { withoutGithubToken, withoutIntegrationSecrets } from '@repo/types';
