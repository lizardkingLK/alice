import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { dbPackageRoot } from '../src/package-root.js';

describe('dbPackageRoot', () => {
  it('finds prisma/schema.prisma from the db package cwd', () => {
    const root = dbPackageRoot();
    expect(path.basename(root)).toBe('db');
    expect(root.replaceAll('\\', '/')).toMatch(/packages\/db$/);
  });

  it('walks up from a nested directory', () => {
    const nested = path.join(process.cwd(), 'src');
    expect(dbPackageRoot(nested)).toBe(dbPackageRoot());
  });
});
