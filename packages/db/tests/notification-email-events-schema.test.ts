import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbPackageRoot } from '../src/package-root.js';

const root = dbPackageRoot();
const migrationsRoot = join(root, 'prisma/migrations');
const migrationName = 'notification_email_events';
const weeklyTemplateMigrationName = 'notification_email_events_weekly_template';
const migration = readFileSync(
  join(migrationsRoot, migrationName, 'migration.sql'),
  'utf8'
);
const weeklyTemplateMigration = readFileSync(
  join(migrationsRoot, weeklyTemplateMigrationName, 'migration.sql'),
  'utf8'
);
const grantsSql = readFileSync(
  join(root, 'prisma/sql/supabase_grants.sql'),
  'utf8'
);

describe('GI-656 notification email event migration', () => {
  it('sorts after the Phase 2B EmailTemplate dependency', () => {
    const migrationNames = readdirSync(migrationsRoot, {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(migrationNames.indexOf(migrationName)).toBeGreaterThan(
      migrationNames.indexOf('add_email_outbox_and_weekly_reports')
    );
    expect(migrationNames.indexOf(weeklyTemplateMigrationName)).toBeGreaterThan(
      migrationNames.indexOf(migrationName)
    );
  });

  it('replaces the template constraint with exactly four supported templates', () => {
    expect(weeklyTemplateMigration).toContain(
      'DROP CONSTRAINT notification_email_events_template_check'
    );
    expect(weeklyTemplateMigration).toContain(
      'ADD CONSTRAINT notification_email_events_template_check'
    );
    const templates = [
      'work_item_assignment',
      'work_item_reassignment',
      'work_item_status_change',
      'weekly_project_report',
    ];
    for (const template of templates) {
      expect(weeklyTemplateMigration).toContain(
        `'${template}'::public."EmailTemplate"`
      );
    }
    expect(
      weeklyTemplateMigration.match(/::public\."EmailTemplate"/g)
    ).toHaveLength(templates.length);
    expect(weeklyTemplateMigration).not.toMatch(
      /ENABLE ROW LEVEL SECURITY|GRANT |REVOKE |CREATE TRIGGER|DROP TRIGGER|PUBLICATION/i
    );
  });

  it('matches the Prisma model and constrains supported event data', () => {
    expect(migration).toContain(
      'CREATE TABLE public.notification_email_events'
    );
    expect(migration).toContain('PRIMARY KEY (notification_id)');
    expect(migration).toContain(
      'REFERENCES public.notifications(id)\n    ON DELETE CASCADE'
    );
    expect(migration).toContain('version INTEGER NOT NULL');
    expect(migration).toContain('template public."EmailTemplate" NOT NULL');
    expect(migration).toContain('payload JSONB NOT NULL');
    expect(migration).toContain(
      'created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
    expect(migration).toContain('CHECK (version = 1)');
    expect(migration).toContain("CHECK (jsonb_typeof(payload) = 'object')");
    for (const template of [
      'work_item_assignment',
      'work_item_reassignment',
      'work_item_status_change',
    ]) {
      expect(migration).toContain(template);
    }
  });

  it('denies clients, prevents updates, and excludes Realtime', () => {
    const revokeIndex = migration.indexOf(
      'REVOKE ALL PRIVILEGES ON TABLE public.notification_email_events'
    );
    const restrictedGrant =
      'GRANT SELECT, INSERT ON TABLE public.notification_email_events TO postgres';
    const restrictedGrantIndex = migration.indexOf(restrictedGrant);

    expect(migration).toContain(
      'ALTER TABLE public.notification_email_events ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).toContain(
      'FROM PUBLIC, anon, authenticated, service_role, postgres'
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT ON TABLE public.notification_email_events TO postgres'
    );
    expect(revokeIndex).toBeGreaterThanOrEqual(0);
    expect(restrictedGrantIndex).toBeGreaterThan(revokeIndex);
    expect(migration.lastIndexOf(restrictedGrant)).toBe(restrictedGrantIndex);
    expect(
      migration.slice(restrictedGrantIndex + restrictedGrant.length)
    ).not.toMatch(
      /GRANT\s+(?:ALL|UPDATE|DELETE|TRUNCATE).*notification_email_events/i
    );
    expect(migration).not.toMatch(
      /GRANT\s+(?:UPDATE|DELETE|TRUNCATE|ALL).*notification_email_events/i
    );
    expect(migration).toContain(
      'CREATE TRIGGER notification_email_events_prevent_update'
    );
    expect(migration).toContain('BEFORE UPDATE');
    expect(migration).not.toContain('BEFORE DELETE');
    expect(migration).toContain('pg_catalog.pg_publication_namespace');
    expect(migration).toContain('DROP TABLE public.notification_email_events');
    expect(migration).toContain(
      'notification_email_events cannot be excluded from supabase_realtime'
    );
  });

  it('survives the shared blanket-grants footer', () => {
    const broadGrantIndex = grantsSql.indexOf(
      'GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role'
    );
    const revokeIndex = grantsSql.indexOf(
      'REVOKE ALL ON TABLE public.notification_email_events FROM PUBLIC, anon, authenticated, service_role, postgres'
    );
    const restrictedGrant =
      'GRANT SELECT, INSERT ON TABLE public.notification_email_events TO postgres';
    const restrictedGrantIndex = grantsSql.indexOf(restrictedGrant);

    expect(broadGrantIndex).toBeGreaterThanOrEqual(0);
    expect(revokeIndex).toBeGreaterThan(broadGrantIndex);
    expect(restrictedGrantIndex).toBeGreaterThan(revokeIndex);
    expect(grantsSql.lastIndexOf(restrictedGrant)).toBe(restrictedGrantIndex);
    const grantsAfterRestriction = grantsSql.slice(
      restrictedGrantIndex + restrictedGrant.length
    );
    expect(grantsAfterRestriction).not.toMatch(
      /GRANT\s+(?:ALL|UPDATE|DELETE|TRUNCATE).*notification_email_events/i
    );
    expect(grantsAfterRestriction).not.toMatch(
      /GRANT\s+ALL\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO[^;]*postgres/i
    );
  });
});
