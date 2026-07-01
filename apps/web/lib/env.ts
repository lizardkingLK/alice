import { z } from 'zod';

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

const processPublicEnv = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_NOVU_APP_ID: process.env.NEXT_PUBLIC_NOVU_APP_ID,
  NEXT_PUBLIC_NOVU_SUBSCRIBER_ID: process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}

function parsePublicEnv(): PublicEnv {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(
      'info. ci environment detected. skipping environment variable validation.'
    );
    return mockPublic;
  }

  const parsed = publicSchema.safeParse(processPublicEnv);

  if (!parsed.success) {
    const details = formatEnvIssues(parsed.error);
    console.error(
      '\x1b[31m%s\x1b[0m',
      'error. invalid or missing environment variables:\n',
      details
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

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      'error. SUPABASE_SERVICE_ROLE_KEY is required for server-side admin operations.'
    );
  }

  return key;
}
