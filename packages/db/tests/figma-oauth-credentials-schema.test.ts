import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbPackageRoot } from '../src/package-root.js';

const root = dbPackageRoot();
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    root,
    'prisma/migrations/add_shared_figma_oauth_credentials/migration.sql'
  ),
  'utf8'
);
const grantsSql = readFileSync(
  join(root, 'prisma/sql/supabase_grants.sql'),
  'utf8'
);

function prismaModel(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) {
    throw new Error(`Prisma model ${name} was not found`);
  }
  return match[1];
}

describe('GI-666 shared Figma OAuth credential foundation', () => {
  it('defines the canonical credential model and status values', () => {
    const credential = prismaModel('figma_oauth_credentials');

    expect(schema).toContain('enum FigmaOAuthCredentialStatus {');
    for (const status of [
      'unknown',
      'active',
      'reauthorization_required',
    ]) {
      expect(schema).toMatch(new RegExp(`\\n  ${status}\\n`));
      expect(migration).toContain(`'${status}'`);
    }

    for (const field of [
      'oauth_app_key',
      'figma_user_id',
      'access_token_enc',
      'refresh_token_enc',
      'access_token_expires_at',
      'scopes',
      'status',
      'token_version',
      'last_validated_at',
      'last_authorized_by',
      'created_at',
      'updated_at',
    ]) {
      expect(credential).toMatch(new RegExp(`\\n  ${field}\\s`));
      expect(migration).toContain(`"${field}"`);
    }

    expect(credential).toContain(
      '@@unique([oauth_app_key, figma_user_id])'
    );
    expect(migration).toContain(
      'figma_oauth_credentials_oauth_app_key_figma_user_id_key'
    );
    expect(migration).toContain(
      '"status" "FigmaOAuthCredentialStatus" NOT NULL DEFAULT \'unknown\''
    );
    expect(migration).toContain(
      '"token_version" INTEGER NOT NULL DEFAULT 1'
    );
    expect(migration).toContain(
      'figma_oauth_credentials_last_authorized_by_fkey'
    );
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE');

    for (const index of [
      'figma_oauth_credentials_status_idx',
      'figma_oauth_credentials_access_token_expires_at_idx',
      'figma_oauth_credentials_last_authorized_by_idx',
    ]) {
      expect(migration).toContain(index);
    }
  });

  it('adds an optional credential binding without changing legacy fields', () => {
    const connection = prismaModel('figma_connections');

    expect(connection).toMatch(/credential_id\s+String\?\s+@db\.Uuid/);
    expect(connection).toContain(
      '@relation(fields: [credential_id], references: [id], onDelete: Restrict)'
    );
    expect(connection).toMatch(/project_id\s+String\s+@unique\s+@db\.Uuid/);

    for (const legacyField of [
      'authorized_by',
      'figma_user_id',
      'access_token_enc',
      'refresh_token_enc',
      'access_token_expires_at',
      'scopes',
      'verified_file_key',
      'verified_file_name',
      'verified_at',
      'verification_error',
    ]) {
      expect(connection).toMatch(new RegExp(`\\n  ${legacyField}\\s`));
    }

    expect(migration).toMatch(
      /ADD COLUMN "credential_id" UUID;\s*\n/
    );
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
  });

  it('is expand-only and does not backfill or touch saved project URLs', () => {
    const lines = migration.split(/\r?\n/).map((line) => line.trimStart());

    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)/i);
    expect(
      lines.some(
        (line) =>
          line.startsWith('INSERT INTO ') ||
          line.startsWith('UPDATE ') ||
          line.startsWith('DELETE FROM ')
      )
    ).toBe(false);
    expect(migration).not.toContain('figma_url');
    expect(migration).not.toMatch(/credential_id"\s+UUID\s+NOT NULL/i);
  });

  it('keeps both Figma secret tables behind the Strategy A boundary', () => {
    expect(migration).toContain(
      'ALTER TABLE "figma_oauth_credentials" ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).not.toContain('CREATE POLICY');

    for (const table of [
      'figma_oauth_credentials',
      'figma_connections',
      'figma_oauth_attempts',
    ]) {
      expect(migration).toContain(
        `REVOKE ALL ON TABLE "${table}" FROM anon, authenticated`
      );
      expect(grantsSql).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`
      );
    }

    expect(migration).toContain(
      'GRANT ALL ON TABLE "figma_oauth_credentials" TO postgres, service_role'
    );
  });
});
