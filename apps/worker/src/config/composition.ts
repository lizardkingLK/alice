import { createRootRouter } from '../routes';

function createRootConfig() {
  const router = createRootRouter();

  return {
    router,
  };
}

export const root = createRootConfig();
