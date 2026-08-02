import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // Next build output is huge (~40k files) and can exhaust inotify watches
    // if the watcher picks it up under the app root.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/.next/**',
    ],
  },
  server: {
    watch: {
      ignored: ['**/.next/**', '**/node_modules/**'],
    },
  },
});
