import { z } from 'zod';

const PLACEHOLDER_PATTERN = /^YOUR_|^your-/i;

function readEnv(key: string): string | undefined {
  const raw = process.env[key];

  if (raw == null) {
    return undefined;
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0 || PLACEHOLDER_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

const requiredPublicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const optionalPublicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  NEXT_PUBLIC_NOVU_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_NOVU_SUBSCRIBER_ID: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof requiredPublicSchema> &
  z.infer<typeof optionalPublicSchema>;

const mockPublic: PublicEnv = {
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
};

function buildRequiredEnvInput() {
  return {
    NEXT_PUBLIC_API_URL: readEnv('NEXT_PUBLIC_API_URL'),
    NEXT_PUBLIC_SUPABASE_URL: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

function buildOptionalEnvInput() {
  const input: Record<string, string | undefined> = {};

  const siteUrl = readEnv('NEXT_PUBLIC_SITE_URL');
  const novuAppId = readEnv('NEXT_PUBLIC_NOVU_APP_ID');
  const novuSubscriberId = readEnv('NEXT_PUBLIC_NOVU_SUBSCRIBER_ID');

  if (siteUrl) {
    input.NEXT_PUBLIC_SITE_URL = siteUrl;
  }

  if (novuAppId) {
    input.NEXT_PUBLIC_NOVU_APP_ID = novuAppId;
  }

  if (novuSubscriberId) {
    input.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID = novuSubscriberId;
  }

  return input;
}

function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}

function warnOptionalEnv(): void {
  const siteUrl = readEnv('NEXT_PUBLIC_SITE_URL');
  const novuAppId = readEnv('NEXT_PUBLIC_NOVU_APP_ID');
  const novuSubscriberId = readEnv('NEXT_PUBLIC_NOVU_SUBSCRIBER_ID');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!siteUrl) {
    console.warn(
      'warn. NEXT_PUBLIC_SITE_URL is not set. Auth email links will use the request origin instead.'
    );
  }

  if (!novuAppId || !novuSubscriberId) {
    console.warn(
      'warn. Novu is not fully configured (NEXT_PUBLIC_NOVU_APP_ID / NEXT_PUBLIC_NOVU_SUBSCRIBER_ID). Notification inbox will be hidden.'
    );
  }

  if (!serviceRoleKey) {
    console.warn(
      'warn. SUPABASE_SERVICE_ROLE_KEY is not set. Server-side admin features (e.g. user management) will be unavailable.'
    );
  }
}

function requiredEnvHints(): string {
  return [
    'Set these in Vercel → Project → Settings → Environment Variables (Production + Preview):',
    '- NEXT_PUBLIC_API_URL',
    '- NEXT_PUBLIC_SUPABASE_URL',
    '- NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'Optional (warn only): NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_NOVU_*, SUPABASE_SERVICE_ROLE_KEY (server secret in Vercel, not in sample.env).',
  ].join(' ');
}

function parsePublicEnv(): PublicEnv {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(
      'info. ci environment detected. skipping environment variable validation.'
    );
    return mockPublic;
  }

  const required = requiredPublicSchema.safeParse(buildRequiredEnvInput());

  if (!required.success) {
    const details = formatEnvIssues(required.error);
    console.error(
      '\x1b[31m%s\x1b[0m',
      'error. invalid or missing required environment variables:\n',
      details,
      '\n',
      requiredEnvHints()
    );
    throw new Error(
      `error. build terminated due to invalid environment variables. ${details}`
    );
  }

  const optional = optionalPublicSchema.safeParse(buildOptionalEnvInput());
  const optionalData = optional.success ? optional.data : {};

  if (!optional.success) {
    console.warn(
      'warn. optional public environment variables are invalid and will be ignored:\n',
      formatEnvIssues(optional.error)
    );
  }

  warnOptionalEnv();

  return {
    ...required.data,
    ...optionalData,
  };
}

export const env = parsePublicEnv();

export function getServiceRoleKey(): string {
  if (process.env.GITHUB_ACTIONS === 'true') {
    return 'mock-service-role-key';
  }

  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!key) {
    throw new Error(
      'error. SUPABASE_SERVICE_ROLE_KEY is required for this operation. Add it as a server-only secret in Vercel (not NEXT_PUBLIC_).'
    );
  }

  return key;
}

export function getOptionalSiteUrl(): string | undefined {
  return env.NEXT_PUBLIC_SITE_URL;
}
