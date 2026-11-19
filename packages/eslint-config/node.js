import globals from 'globals';
import { config as baseConfig } from './base.js';

/**
 * Shared flat ESLint config for Express/Node apps under `apps/*`.
 *
 * @param {{ tsconfigRootDir: string }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function createNodeAppConfig({ tsconfigRootDir }) {
  const sharedRules = {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    'prefer-const': 'error',
  };

  return [
    {
      ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
    },
    ...baseConfig,
    {
      files: ['src/**/*.ts'],
      languageOptions: {
        globals: {
          ...globals.node,
        },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: sharedRules,
    },
    {
      files: ['tests/**/*.ts'],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
      rules: sharedRules,
    },
  ];
}
