import type { SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

/** Matches `apps/api` storage bucket env defaults. */
export const SEED_STORAGE_BUCKETS = [
  'alice_storage_attachments',
  'alice_storage_profile_pictures',
  'alice_storage_profile_covers',
  'alice_storage_chat_history',
] as const;

export const PRISMA_MIGRATIONS_TABLE = '_prisma_migrations';

const STORAGE_LIST_PAGE = 1000;
const STORAGE_REMOVE_CHUNK = 100;

export function isSeedResetRequested(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv
): boolean {
  return env.SEED_RESET === '1' || argv.includes('--reset');
}

export function buildWipePublicAndAuthSql(): string {
  return `
DO $wipe$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '${PRISMA_MIGRATIONS_TABLE}'
  LOOP
    EXECUTE format(
      'TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE',
      r.tablename
    );
  END LOOP;
END
$wipe$;

TRUNCATE TABLE auth.users CASCADE;
`;
}

export function isMissingStorageBucketError(message: string): boolean {
  return /not found|does not exist/i.test(message);
}

function joinStoragePath(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

async function listStorageObjectPaths(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: STORAGE_LIST_PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      if (isMissingStorageBucketError(error.message)) {
        return [];
      }
      throw new Error(
        `Failed to list storage bucket "${bucket}": ${error.message}`
      );
    }

    const entries = data ?? [];
    for (const entry of entries) {
      const childPath = joinStoragePath(prefix, entry.name);
      if (entry.id) {
        paths.push(childPath);
      } else {
        const nested = await listStorageObjectPaths(
          supabase,
          bucket,
          childPath
        );
        paths.push(...nested);
      }
    }

    if (entries.length < STORAGE_LIST_PAGE) {
      break;
    }
    offset += STORAGE_LIST_PAGE;
  }

  return paths;
}

async function emptyStorageBucket(
  supabase: SupabaseClient,
  bucket: string
): Promise<number> {
  const paths = await listStorageObjectPaths(supabase, bucket, '');
  if (paths.length === 0) {
    return 0;
  }

  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_CHUNK) {
    const chunk = paths.slice(index, index + STORAGE_REMOVE_CHUNK);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error && !isMissingStorageBucketError(error.message)) {
      throw new Error(
        `Failed to empty storage bucket "${bucket}": ${error.message}`
      );
    }
  }

  return paths.length;
}

async function emptySeedStorageBuckets(
  supabase: SupabaseClient
): Promise<void> {
  for (const bucket of SEED_STORAGE_BUCKETS) {
    const removed = await emptyStorageBucket(supabase, bucket);
    console.log(
      `info. emptied storage bucket "${bucket}" (${removed} objects).`
    );
  }
}

async function wipePublicAuthAndStorageRows(
  connectionString: string
): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(buildWipePublicAndAuthSql());
  } finally {
    await client.end();
  }
}

/**
 * Destructive: truncates public app tables (keeps `_prisma_migrations`),
 * deletes Auth users, and empties Alice storage buckets.
 */
export async function resetDevData(
  supabase: SupabaseClient,
  directUrl: string
): Promise<void> {
  await emptySeedStorageBuckets(supabase);
  await wipePublicAuthAndStorageRows(directUrl);
  console.log(
    'info. wiped public tables and auth.users. Storage buckets emptied via Storage API.'
  );
}
