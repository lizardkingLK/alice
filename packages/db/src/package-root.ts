import { existsSync } from 'node:fs';
import path from 'node:path';

const SCHEMA_REL = path.join('prisma', 'schema.prisma');
const MAX_WALK_DEPTH = 6;

/**
 * Directory that contains `prisma/schema.prisma` (the `@repo/db` package root).
 * Walks up from `cwd` so CJS builds do not need `import.meta.url`.
 */
export function dbPackageRoot(fromDir: string = process.cwd()): string {
  let dir = path.resolve(fromDir);
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth += 1) {
    if (existsSync(path.join(dir, SCHEMA_REL))) {
      return dir;
    }
    const parent = path.resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    'error. could not find packages/db (prisma/schema.prisma) from cwd'
  );
}
