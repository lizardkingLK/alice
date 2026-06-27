import dotenv from 'dotenv';
import path from 'path';

if (!process.env.PORT) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  console.log(
    '\x1b[36m%s\x1b[0m',
    'info. local environment file successfully parsed into runtime storage memory.'
  );
} else {
  console.log(
    '\x1b[36m%s\x1b[0m',
    'info. remote cloud system environment detected. Utilizing native dashboard secrets.'
  );
}

import './env';
