import { existsSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

let envPath = path.resolve(process.cwd(), '.env');

if (!existsSync(envPath)) {
  envPath = path.resolve(__dirname, '../../../.env');
}

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(
    '\x1b[36m%s\x1b[0m',
    `info. local environment file successfully parsed from ${envPath}`
  );
} else if (process.env.PORT) {
  console.log(
    '\x1b[36m%s\x1b[0m',
    'info. remote cloud system environment detected. Utilizing native dashboard secrets.'
  );
} else {
  console.log(
    '\x1b[31m%s\x1b[0m',
    'warning. no .env file found in process.cwd() or apps/api/.env'
  );
}
