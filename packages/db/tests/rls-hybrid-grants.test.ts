import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbPackageRoot } from '../src/package-root.js';

const root = dbPackageRoot();

const grantsSql = readFileSync(
  join(root, 'prisma/sql/supabase_grants.sql'),
  'utf8'
);

const p0Sql = readFileSync(
  join(root, 'prisma/migrations/rls_hybrid_p0_secrets_lockdown/migration.sql'),
  'utf8'
);

const p2Sql = readFileSync(
  join(
    root,
    'prisma/migrations/rls_hybrid_p2_rollups_and_review/migration.sql'
  ),
  'utf8'
);

const prismaMigrationsLockdownSql = readFileSync(
  join(
    root,
    'prisma/migrations/rls_hybrid_prisma_migrations_lockdown/migration.sql'
  ),
  'utf8'
);

/** Tables that must stay Strategy A (revoke anon/authenticated) after grants. */
const STRATEGY_A_TABLES = [
  'integrations',
  'project_management_connections',
  'version_control_connections',
  'chat_attachments',
  'access_allowlist',
  'access_requests',
  'work_item_links',
  'work_item_chart_rollups',
  'work_item_chart_hierarchy_rollups',
  'sprint_burndown_rollups',
  '_prisma_migrations',
] as const;

describe('hybrid RLS grants regression', () => {
  it('re-revokes Strategy A tables after blanket anon/authenticated grants', () => {
    for (const table of STRATEGY_A_TABLES) {
      expect(grantsSql).toMatch(
        new RegExp(
          `REVOKE ALL ON TABLE public\\.${table} FROM anon, authenticated`,
          'i'
        )
      );
    }
  });

  it('revokes users writes for anon/authenticated while allowing SELECT policies elsewhere', () => {
    expect(grantsSql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.users FROM anon, authenticated/i
    );
    expect(p0Sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(p0Sql).toMatch(/users_authenticated_select/i);
  });

  it('locks rollups and work_item_links in P2 migration', () => {
    for (const table of [
      'work_item_links',
      'work_item_chart_rollups',
      'work_item_chart_hierarchy_rollups',
      'sprint_burndown_rollups',
    ] as const) {
      expect(p2Sql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`
      );
      expect(p2Sql).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM anon, authenticated`
      );
    }
  });

  it('locks _prisma_migrations from PostgREST (advisor RLS Disabled In Public)', () => {
    expect(prismaMigrationsLockdownSql).toContain(
      'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY'
    );
    expect(prismaMigrationsLockdownSql).toContain(
      'REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated'
    );
  });
});
