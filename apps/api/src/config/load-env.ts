import { loadAppEnv } from '@repo/http-kit';

loadAppEnv({
  appLabel: 'apps/api',
  moduleDirname: __dirname,
});
