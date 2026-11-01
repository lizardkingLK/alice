import { existsSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

export type LoadAppEnvOptions = {
  /** Shown in the missing-file warning, e.g. `apps/api`. */
  appLabel: string;
  /**
   * Directory of the calling module (`__dirname` / `import.meta.dirname`).
   * Used to resolve the fallback `../../../.env` path (same as historical
   * api/worker loaders).
   */
  moduleDirname: string;
};

/** Load `.env` from cwd, then a module-relative fallback; log which source won. */
export function loadAppEnv(options: LoadAppEnvOptions): void {
  const { appLabel, moduleDirname } = options;

  let envPath = path.resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    envPath = path.resolve(moduleDirname, '../../../.env');
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
      `warning. no .env file found in process.cwd() or ${appLabel}/.env`
    );
  }
}
