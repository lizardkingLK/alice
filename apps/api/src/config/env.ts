import { z } from 'zod';

const serverSchema = z.object({
  PORT: z.coerce.number(),
  FRONTEND_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STORAGE_BUCKET_ATTACHMENTS: z.string().min(1),
  STORAGE_BUCKET_PROFILE_PICTURES: z.string().min(1),
  STORAGE_BUCKET_CHAT_HISTORY: z.string().min(1),
  JIRA_API_TOKEN: z.string().optional(),
  JIRA_EMAIL: z.string().optional(),
  /** Optional; when set, `/notifications/check-due-dates` requires `Authorization: Bearer <CRON_SECRET>`. */
  CRON_SECRET: z.string().min(1).optional(),
  /** Pooled Postgres URL for Prisma Client (Supavisor session mode, port 5432). */
  DATABASE_URL: z.string().min(1),
});

type EnvSchemaType = z.infer<typeof serverSchema>;

const mock: EnvSchemaType = {
  PORT: 5000,
  FRONTEND_URL: 'http://localhost:3000',
  SUPABASE_URL: 'https://supabase.co',
  SUPABASE_ANON_KEY: 'mock',
  SUPABASE_SERVICE_ROLE_KEY: 'mock',
  STORAGE_BUCKET_ATTACHMENTS: 'alice_storage_attachments',
  STORAGE_BUCKET_PROFILE_PICTURES: 'alice_storage_profile_pictures',
  STORAGE_BUCKET_CHAT_HISTORY: 'alice_storage_chat_history',
  JIRA_API_TOKEN: 'mock',
  JIRA_EMAIL: 'mock@atlassian.net',
  CRON_SECRET: 'mock-cron-secret',
  DATABASE_URL: 'postgresql://localhost:5432/postgres',
};

const processEnv = {
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STORAGE_BUCKET_ATTACHMENTS: process.env.STORAGE_BUCKET_ATTACHMENTS,
  STORAGE_BUCKET_PROFILE_PICTURES: process.env.STORAGE_BUCKET_PROFILE_PICTURES,
  STORAGE_BUCKET_CHAT_HISTORY: process.env.STORAGE_BUCKET_CHAT_HISTORY,
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
  JIRA_EMAIL: process.env.JIRA_EMAIL,
  CRON_SECRET: process.env.CRON_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
};

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
