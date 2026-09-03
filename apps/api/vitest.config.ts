import { defineConfig } from 'vitest/config';

const isCi = Boolean(process.env.GITHUB_ACTIONS);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: isCi ? 15_000 : 10_000,
    hookTimeout: isCi ? 15_000 : 10_000,
    ...(isCi ? { maxWorkers: 2 } : {}),
  },
});
