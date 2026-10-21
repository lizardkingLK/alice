/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Opt-in live PostgREST checks for hybrid RLS (Strategy A + write denies).
 *
 * Anon (no JWT):
 *   RUN_RLS_NEGATIVE_TESTS=1 \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   pnpm turbo run test --filter=@repo/db -- --run tests/rls-hybrid-postgrest.live.test.ts
 *
 * Authenticated session (non-admin JWT recommended):
 *   …same as above, plus:
 *   RLS_NEGATIVE_TEST_USER_JWT=<access_token>
 *
 * Skipped by default so unit CI stays green without a live Supabase stack.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const runLive = process.env.RUN_RLS_NEGATIVE_TESTS === '1';
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';
const userJwt = process.env.RLS_NEGATIVE_TEST_USER_JWT?.trim() ?? '';

const describeLive =
  runLive && supabaseUrl && anonKey ? describe : describe.skip;
const describeAuthLive =
  runLive && supabaseUrl && anonKey && userJwt ? describe : describe.skip;

const STRATEGY_A_SELECT_TABLES = [
  'access_allowlist',
  'access_requests',
  'project_management_connections',
  'version_control_connections',
  'chat_attachments',
  'integrations',
  'work_item_links',
  'work_item_chart_rollups',
  'work_item_chart_hierarchy_rollups',
  'sprint_burndown_rollups',
  '_prisma_migrations',
] as const;

function anonClient(): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authenticatedClient(): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  });
}

/** Permission denied / RLS empty are both acceptable lockdown signals. */
function isLockedResponse(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  );
}

async function expectSelectLocked(
  client: SupabaseClient,
  table: (typeof STRATEGY_A_SELECT_TABLES)[number]
): Promise<void> {
  const { data, error } = await client.from(table).select('*').limit(1);
  expect(isLockedResponse(error) || data == null || data.length === 0).toBe(
    true
  );
  if (!error) {
    expect(data).toEqual([]);
  }
}

describeLive('hybrid RLS PostgREST negative checks (anon)', () => {
  it.each(STRATEGY_A_SELECT_TABLES)(
    'anon cannot read %s via PostgREST',
    async (table) => {
      await expectSelectLocked(anonClient(), table);
    }
  );

  it('anon cannot insert into users via PostgREST', async () => {
    const { error } = await anonClient()
      .from('users')
      .insert({
        id: '00000000-0000-4000-8000-000000000000',
        email: 'rls-negative@example.com',
        name: 'RLS Negative',
      } as never);
    expect(isLockedResponse(error) || error != null).toBe(true);
  });

  it('anon cannot insert into notifications via PostgREST', async () => {
    const { error } = await anonClient()
      .from('notifications')
      .insert({
        user_id: '00000000-0000-4000-8000-000000000000',
        type: 'system',
        title: 'rls-negative',
      } as never);
    expect(isLockedResponse(error) || error != null).toBe(true);
  });
});

describeAuthLive('hybrid RLS PostgREST negative checks (authenticated)', () => {
  it.each([
    'access_allowlist',
    'access_requests',
    'work_item_links',
    'work_item_chart_rollups',
    'work_item_chart_hierarchy_rollups',
    'sprint_burndown_rollups',
  ] as const)('authenticated cannot read %s via PostgREST', async (table) => {
    await expectSelectLocked(authenticatedClient(), table);
  });

  it('authenticated cannot insert into users via PostgREST', async () => {
    const { error } = await authenticatedClient()
      .from('users')
      .insert({
        id: '00000000-0000-4000-8000-000000000001',
        email: 'rls-auth-negative@example.com',
        name: 'RLS Auth Negative',
      } as never);
    expect(isLockedResponse(error) || error != null).toBe(true);
  });

  it('authenticated cannot update users via PostgREST', async () => {
    const { error } = await authenticatedClient()
      .from('users')
      .update({ name: 'rls-auth-negative' } as never)
      .eq('id', '00000000-0000-4000-8000-000000000000');
    expect(isLockedResponse(error) || error != null).toBe(true);
  });

  it('authenticated cannot delete users via PostgREST', async () => {
    const { error } = await authenticatedClient()
      .from('users')
      .delete()
      .eq('id', '00000000-0000-4000-8000-000000000000');
    expect(isLockedResponse(error) || error != null).toBe(true);
  });

  it('authenticated cannot insert into notifications via PostgREST', async () => {
    const { error } = await authenticatedClient()
      .from('notifications')
      .insert({
        user_id: '00000000-0000-4000-8000-000000000000',
        type: 'system',
        title: 'rls-auth-negative',
      } as never);
    expect(isLockedResponse(error) || error != null).toBe(true);
  });
});
