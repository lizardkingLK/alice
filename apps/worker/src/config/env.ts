import { z } from 'zod';

const workerServerSchema = z.object({
  PORT: z.coerce.number(),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().min(1),
});

type EnvSchemaType = z.infer<typeof workerServerSchema>;

const mock: EnvSchemaType = {
  PORT: 5001,
  DATABASE_URL: 'postgresql://localhost:5432/postgres',
  FRONTEND_URL: 'http://localhost:3000',
};

const processEnv = {
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

let data: EnvSchemaType;

if (process.env.GITHUB_ACTIONS === 'true') {
  console.log(
    'info. ci environment detected. skipping environment variable validation'
  );
  data = mock;
} else {
  const parsed = workerServerSchema.safeParse(processEnv);

  if (parsed.success === false) {
    console.log(
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
