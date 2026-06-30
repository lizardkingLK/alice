import 'dotenv/config';
import { defineConfig } from 'prisma/config';

import './src/env.js';

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
