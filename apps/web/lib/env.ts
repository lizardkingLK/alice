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

const publicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_NOVU_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_NOVU_SUBSCRIBER_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

const mockPublic: PublicEnv = {
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
};

function buildPublicEnvInput() {
  const input: Record<string, string | undefined> = {
    NEXT_PUBLIC_API_URL: readEnv('NEXT_PUBLIC_API_URL'),
    NEXT_PUBLIC_SUPABASE_URL: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };

  const novuAppId = readEnv('NEXT_PUBLIC_NOVU_APP_ID');
  const novuSubscriberId = readEnv('NEXT_PUBLIC_NOVU_SUBSCRIBER_ID');
  const siteUrl = readEnv('NEXT_PUBLIC_SITE_URL');

  if (novuAppId) {
    input.NEXT_PUBLIC_NOVU_APP_ID = novuAppId;
  }

  if (novuSubscriberId) {
    input.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID = novuSubscriberId;
  }

  if (siteUrl) {
    input.NEXT_PUBLIC_SITE_URL = siteUrl;
  }

  return input;
}

function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}

function requiredEnvHints(): string {
  return [
    'Set these in Vercel → Project → Settings → Environment Variables (Production + Preview):',
    '- NEXT_PUBLIC_API_URL (e.g. https://your-api.vercel.app)',
    '- NEXT_PUBLIC_SUPABASE_URL (e.g. https://xxxx.supabase.co)',
    '- NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase anon/public key)',
    'Remove empty or YOUR_* placeholder values for optional vars (Novu, SITE_URL).',
  ].join(' ');
}

function parsePublicEnv(): PublicEnv {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(
      'info. ci environment detected. skipping environment variable validation.'
    );
    return mockPublic;
  }

  const parsed = publicSchema.safeParse(buildPublicEnvInput());

  if (!parsed.success) {
    const details = formatEnvIssues(parsed.error);
    console.error(
      '\x1b[31m%s\x1b[0m',
      'error. invalid or missing environment variables:\n',
      details,
      '\n',
      requiredEnvHints()
    );
    throw new Error(
      `error. build terminated due to invalid environment variables. ${details}`
    );
  }

  return parsed.data;
}

export const env = parsePublicEnv();

export function getServiceRoleKey(): string {
  if (process.env.GITHUB_ACTIONS === 'true') {
    return 'mock-service-role-key';
  }

  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!key) {
    throw new Error(
      'error. SUPABASE_SERVICE_ROLE_KEY is required for server-side admin operations.'
    );
  }

  return key;
}
