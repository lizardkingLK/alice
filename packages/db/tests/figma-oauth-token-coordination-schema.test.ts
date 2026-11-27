import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbPackageRoot } from '../src/package-root.js';

const root = dbPackageRoot();
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    root,
    'prisma/migrations/add_figma_oauth_token_coordination/migration.sql'
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

function prismaEnum(name: string): string {
  const match = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) {
    throw new Error(`Prisma enum ${name} was not found`);
  }
  return match[1];
}

describe('GI-666 Phase 4C Figma OAuth token coordination schema (static)', () => {
  it('defines operation, binding, and explicit-resolution enums', () => {
    expect(prismaEnum('FigmaOAuthOperationKind')).toContain(
      'authorization_code_exchange'
    );
    expect(prismaEnum('FigmaOAuthOperationKind')).toContain('token_refresh');

    for (const status of [
      'prepared',
      'requesting',
      'response_received',
      'outcome_unknown',
      'provider_rejected',
      'finalized',
      'superseded',
      'expired',
    ]) {
      expect(prismaEnum('FigmaOAuthOperationStatus')).toMatch(
        new RegExp(`\\n  ${status}(?:\\n|$)`)
      );
      expect(migration).toContain(`'${status}'`);
    }

    for (const status of ['not_applicable', 'pending', 'applied', 'skipped']) {
      expect(prismaEnum('FigmaOAuthProjectBindingStatus')).toMatch(
        new RegExp(`\\n  ${status}(?:\\n|$)`)
      );
    }

    for (const resolution of [
      'provider_rejection_confirmed',
      'provider_access_revoked',
      'oauth_app_credentials_rotated',
    ]) {
      expect(prismaEnum('FigmaOAuthOperationResolution')).toMatch(
        new RegExp(`\\n  ${resolution}(?:\\n|$)`)
      );
    }
  });

  it('defines the durable journal and local ordering fields', () => {
    const operation = prismaModel('figma_oauth_operations');

    for (const field of [
      'journal_sequence',
      'kind',
      'status',
      'oauth_app_key',
      'oauth_attempt_id',
      'oauth_attempt_nonce_hash',
      'authorization_code_hash',
      'source_refresh_token_hash',
      'project_id',
      'project_binding_generation',
      'initiated_by',
      'credential_id',
      'figma_user_id',
      'expected_token_version',
      'worker_token',
      'pending_token_response_enc',
      'pending_token_key_version',
      'pending_token_expires_at',
      'project_binding_status',
      'resolution',
      'retention_expires_at',
    ]) {
      expect(operation).toMatch(new RegExp(`\\n  ${field}\\s`));
      expect(migration).toContain(`"${field}"`);
    }

    expect(operation).toMatch(
      /journal_sequence\s+BigInt\s+@unique\s+@default\(autoincrement\(\)\)/
    );
    expect(operation).toContain(
      'status                          FigmaOAuthOperationStatus      @default(prepared)'
    );
    expect(schema).toContain(
      '`journal_sequence` is a local stale-worker fence, never evidence of provider issuance order.'
    );
  });

  it('uses nullable SetNull journal foreign keys so deletion is not blocked', () => {
    const operation = prismaModel('figma_oauth_operations');

    for (const field of [
      'oauth_attempt_id',
      'project_id',
      'initiated_by',
      'resolved_by',
      'credential_id',
    ]) {
      expect(operation).toMatch(new RegExp(`\\n  ${field}\\s+String\\?`));
      expect(migration).toContain(`figma_oauth_operations_${field}_fkey`);
    }

    expect(
      migration.match(/ON DELETE SET NULL ON UPDATE CASCADE/g)
    ).toHaveLength(6);
    expect(operation.match(/onDelete: SetNull/g)).toHaveLength(5);
  });

  it('keeps credential token fences separate from project binding fences', () => {
    const project = prismaModel('projects');
    const credential = prismaModel('figma_oauth_credentials');
    const connection = prismaModel('figma_connections');

    expect(project).toMatch(/figma_binding_generation\s+Int\s+@default\(0\)/);
    expect(credential).toMatch(
      /last_token_operation_sequence\s+BigInt\s+@default\(0\)/
    );
    expect(credential).toMatch(
      /last_token_operation_id\s+String\?\s+@unique\s+@db\.Uuid/
    );
    expect(connection).toMatch(/binding_generation\s+Int\s+@default\(0\)/);
    expect(connection).toMatch(/credential_token_version\s+Int\?/);
    expect(connection).not.toContain('last_token_operation_id');
    expect(connection).not.toContain('last_applied_operation_id');
  });

  it('allows many project connections to reference one credential', () => {
    const credential = prismaModel('figma_oauth_credentials');
    const connection = prismaModel('figma_connections');

    expect(credential).toContain('project_connections     figma_connections[]');
    expect(connection).toContain(
      'credential         figma_oauth_credentials? @relation(fields: [credential_id], references: [id], onDelete: Restrict)'
    );
    expect(connection).toContain('@@index([credential_id])');
    expect(connection).not.toContain('@@unique([credential_id])');
    expect(migration).not.toMatch(
      /CREATE UNIQUE INDEX[^;]+figma_connections[^;]+credential_id/is
    );
  });

  it('extends attempts compatibly and leaves current rows valid', () => {
    const attempt = prismaModel('figma_oauth_attempts');

    expect(attempt).toMatch(/oauth_app_key\s+String\?/);
    expect(attempt).toMatch(/project_binding_generation\s+Int\?/);
    expect(attempt).toMatch(/code_verifier_enc\s+String\?/);
    expect(migration).toContain(
      'ALTER COLUMN "code_verifier_enc" DROP NOT NULL'
    );
    expect(migration).toContain(
      'ADD COLUMN "figma_binding_generation" INTEGER NOT NULL DEFAULT 0'
    );
    expect(migration).toContain(
      'ADD COLUMN "last_token_operation_sequence" BIGINT NOT NULL DEFAULT 0'
    );
    expect(migration).toContain(
      'ADD COLUMN "binding_generation" INTEGER NOT NULL DEFAULT 0'
    );
    expect(migration).toContain(
      'ADD COLUMN "credential_token_version" INTEGER'
    );
  });

  it('adds lifecycle checks and only a requesting-operation partial index', () => {
    for (const constraint of [
      'figma_oauth_operations_sequence_positive',
      'figma_oauth_operations_expected_version_positive',
      'figma_oauth_operations_binding_generation_nonnegative',
      'figma_oauth_operations_kind_inputs',
      'figma_oauth_operations_pending_envelope_complete',
      'figma_oauth_operations_response_has_envelope',
      'figma_oauth_operations_request_worker',
      'figma_oauth_operations_request_timestamps',
      'figma_oauth_operations_response_timestamp',
      'figma_oauth_operations_unknown_timestamp',
      'figma_oauth_operations_terminal_timestamp',
      'figma_oauth_operations_binding_lifecycle',
      'figma_oauth_operations_resolution_complete',
      'figma_oauth_operations_resolution_status',
    ]) {
      expect(migration).toContain(`CONSTRAINT "${constraint}"`);
    }

    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "figma_oauth_operations_one_requesting_per_app"[\s\S]*WHERE "status" = 'requesting';/
    );
    expect(migration).not.toMatch(
      /WHERE "status" IN \([\s\S]*'outcome_unknown'/
    );
    expect(migration).toContain(
      'This index does not enforce the full coordinator safety policy.'
    );
    expect(migration).toContain('conflicting response_received rows');
  });

  it('documents ambiguity and expired-ciphertext safety for future code', () => {
    expect(migration).toContain(
      'outcome_unknown -> provider_rejected|superseded only after explicit,'
    );
    expect(migration).toContain(
      'A timeout or secret rotation alone is not proof'
    );
    expect(migration).toContain(
      'Expired response_received ciphertext may be erased only by atomically moving'
    );
    expect(migration).toContain(
      'intentionally supplies no cleanup or coordinator.'
    );
  });

  it('keeps the migration expand-only with no data backfill', () => {
    const statements = migration.split(/\r?\n/).map((line) => line.trimStart());

    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)/i);
    expect(
      statements.some(
        (line) =>
          line.startsWith('INSERT INTO ') ||
          line.startsWith('UPDATE ') ||
          line.startsWith('DELETE FROM ')
      )
    ).toBe(false);
  });

  it('locks down the journal table and its sequence', () => {
    expect(migration).toContain(
      'ALTER TABLE "figma_oauth_operations" ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).toContain(
      'GRANT ALL ON TABLE "figma_oauth_operations" TO postgres, service_role'
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE "figma_oauth_operations"\s+FROM PUBLIC, anon, authenticated;/
    );
    expect(migration).toMatch(
      /GRANT USAGE, SELECT ON SEQUENCE\s+"figma_oauth_operations_journal_sequence_seq"\s+TO postgres, service_role;/
    );
    expect(migration).toMatch(
      /REVOKE ALL ON SEQUENCE "figma_oauth_operations_journal_sequence_seq"\s+FROM PUBLIC, anon, authenticated;/
    );

    expect(grantsSql).toContain(
      'REVOKE ALL ON TABLE public.figma_oauth_operations FROM PUBLIC, anon, authenticated'
    );
    expect(grantsSql).toContain(
      'REVOKE ALL ON SEQUENCE public.figma_oauth_operations_journal_sequence_seq FROM PUBLIC, anon, authenticated'
    );
    expect(grantsSql).toContain(
      'GRANT USAGE, SELECT ON SEQUENCE public.figma_oauth_operations_journal_sequence_seq TO postgres, service_role'
    );
  });
});

// These tests intentionally inspect schema and SQL text only. Applying the
// migration, exercising FK SET NULL actions, checking PostgreSQL CHECK
// enforcement, and testing role privileges require a separately confirmed,
// isolated PostgreSQL database and are not performed by this unit suite.
