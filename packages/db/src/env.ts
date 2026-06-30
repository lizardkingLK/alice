import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

dotenv.config({ path: path.join(packageRoot, '.env') });

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

type EnvSchemaType = z.infer<typeof serverSchema>;

const mock: EnvSchemaType = {
  DATABASE_URL: 'postgresql://localhost:5432/postgres',
  DIRECT_URL: 'postgresql://localhost:5432/postgres',
  SUPABASE_URL: 'https://supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'mock',
};

const processEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const parsed = serverSchema.safeParse(processEnv);

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
      'error. db package terminated due to invalid environment variables.'
    );
  }

  data = parsed.data;
}

export const env = data;
