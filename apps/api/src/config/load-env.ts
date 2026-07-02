import { existsSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(
    '\x1b[36m%s\x1b[0m',
    'info. local environment file successfully parsed into runtime storage memory.'
  );
} else if (process.env.PORT) {
  console.log(
    '\x1b[36m%s\x1b[0m',
    'info. remote cloud system environment detected. Utilizing native dashboard secrets.'
  );
}
