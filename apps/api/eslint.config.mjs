import globals from 'globals';
import { config as baseConfig } from "@repo/eslint-config/base";

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
    },
    ...baseConfig,
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': 'off',
            'prefer-const': 'error',
        },
    },
];
