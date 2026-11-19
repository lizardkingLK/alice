/**
 * Unit tests import routes/services that load `src/config/env.ts` at module
 * init. Skip Zod validation and use the built-in mock env (same as CI).
 */
process.env.GITHUB_ACTIONS = 'true';
