import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbPackageRoot } from '../src/package-root.js';

const root = dbPackageRoot();
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    root,
    'prisma/migrations/add_email_outbox_and_weekly_reports/migration.sql'
  ),
  'utf8'
);

describe('GI-656 email outbox schema', () => {
  it('defines durable delivery and weekly-report models', () => {
    for (const model of [
      'email_outbox',
      'notification_email_preferences',
      'weekly_project_report_subscriptions',
      'weekly_project_reports',
    ]) {
      expect(schema).toContain(`model ${model} {`);
      expect(migration).toContain(`CREATE TABLE "${model}"`);
    }
    expect(schema).toContain('weekly_project_report');
    expect(schema).toContain('dedupe_key');
  });

  it('enforces delivery idempotency, retry limits, and weekly uniqueness', () => {
    expect(migration).toContain('email_outbox_notification_id_key');
    expect(migration).toContain('email_outbox_idempotency_key_key');
    expect(migration).toContain('email_outbox_attempt_limit_check');
    expect(migration).toContain(
      'weekly_project_reports_project_id_user_id_period_start_key'
    );
    expect(migration).toContain(
      'email_outbox_status_next_attempt_at_created_at_idx'
    );
    expect(migration).toContain('email_outbox_status_locked_until_idx');
  });

  it('keeps delivery payloads private and scopes preference writes', () => {
    for (const table of ['email_outbox', 'weekly_project_reports']) {
      expect(migration).toContain(
        `REVOKE ALL ON TABLE "${table}" FROM anon, authenticated`
      );
      expect(migration).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`
      );
    }
    expect(migration).toContain('notification_email_preferences_update_own');
    expect(migration).toContain(
      'weekly_project_report_subscriptions_update_own'
    );
    expect(migration).toContain('pm."status" = \'active\'');
  });
});
