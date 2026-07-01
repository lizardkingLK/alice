import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

import './src/env.js';

dotenv.config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'],
  },
});
