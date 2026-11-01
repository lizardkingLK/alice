import { createNodeAppConfig } from '@repo/eslint-config/node';

/** @type {import("eslint").Linter.Config[]} */
export default createNodeAppConfig({
  tsconfigRootDir: import.meta.dirname,
});
