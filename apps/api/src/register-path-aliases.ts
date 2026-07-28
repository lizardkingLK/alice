import Module from 'node:module';
import path from 'node:path';

/**
 * Vercel `@vercel/node` compiles `src/` without rewriting tsconfig `paths`.
 * Register `@/*` → this directory before any `@/` imports run.
 */
type ResolveFilename = (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: Record<string, unknown>
) => string;

const moduleWithResolve = Module as typeof Module & {
  _resolveFilename: ResolveFilename;
};

const originalResolveFilename = moduleWithResolve._resolveFilename.bind(Module);

moduleWithResolve._resolveFilename = (request, parent, isMain, options) => {
  if (request.startsWith('@/')) {
    return originalResolveFilename(
      path.join(__dirname, request.slice(2)),
      parent,
      isMain,
      options
    );
  }

  return originalResolveFilename(request, parent, isMain, options);
};
