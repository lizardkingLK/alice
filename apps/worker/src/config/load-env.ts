import { loadAppEnv } from '@repo/http-kit';

loadAppEnv({
  appLabel: 'apps/worker',
  moduleDirname: __dirname,
});
