import globals from 'globals';
import { config as baseConfig } from '@repo/eslint-config/base';

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'prisma/migrations/**'],
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
