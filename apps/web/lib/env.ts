import { z } from 'zod';

const serverSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_NOVU_APP_ID: z.string().min(1),
  NEXT_PUBLIC_NOVU_SUBSCRIBER_ID: z.string().min(1),
});

const mergedSchema = serverSchema.extend(clientSchema.shape);
type EnvSchemaType = z.infer<typeof mergedSchema>;

const mock: EnvSchemaType = {
  SUPABASE_URL: 'https://supabase.co',
  SUPABASE_ANON_KEY: 'mock',
  SUPABASE_SERVICE_ROLE_KEY: 'mock',
  NEXT_PUBLIC_API_URL: 'http://localhost',
  NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock',
  NEXT_PUBLIC_NOVU_APP_ID: 'mock',
  NEXT_PUBLIC_NOVU_SUBSCRIBER_ID: 'mock',
};

const processEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_NOVU_APP_ID: process.env.NEXT_PUBLIC_NOVU_APP_ID,
  NEXT_PUBLIC_NOVU_SUBSCRIBER_ID: process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID,
};

const parsed = mergedSchema.safeParse(processEnv);

let data: EnvSchemaType;

if (process.env.GITHUB_ACTIONS === 'true') {
  console.log(
    'info. ci environment detected. skipping environment variable validation.'
  );
  data = mock;
} else {
  if (parsed.success === false) {
    console.error(
      '\x1b[31m%s\x1b[0m',
      'error. invalid or missing environment variables:\n',
      z.treeifyError(parsed.error)
    );
    throw new Error(
      'error. build terminated due to invalid environment variables.'
    );
  }

  data = parsed.data;
}

export const env = data;
