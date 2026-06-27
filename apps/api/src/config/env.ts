import { z } from 'zod';

const mock: EnvSchemaType = {
  PORT: 5000,
  FRONTEND_URL: 'http://localhost:3000',
  SUPABASE_URL: 'https://supabase.co',
  SUPABASE_ANON_KEY: 'mock',
  SUPABASE_SERVICE_ROLE_KEY: 'mock',
};

const serverSchema = z.object({
  PORT: z.coerce.number(),
  FRONTEND_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const processEnv = {
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

type EnvSchemaType = z.infer<typeof serverSchema>;

let data: EnvSchemaType;

if (process.env.GITHUB_ACTIONS === 'true') {
  console.log(
    'info. ci environment detected. skipping environment variable validation.'
  );
  data = mock;
} else {
  const parsed = serverSchema.safeParse(processEnv);

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
