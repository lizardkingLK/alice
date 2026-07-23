import { defineConfig } from 'cypress';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0]!.trim();
          let value = parts.slice(1).join('=').trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      });
    }
  } catch (err) {
    console.error('Failed to load .env.local:', err);
  }
}

loadEnvLocal();

interface SupabaseUsers {
  adminUser: User | undefined;
  managerUser: User | undefined;
}

async function getSupabaseUsers(
  supabase: SupabaseClient,
  testUserEmail: string
): Promise<SupabaseUsers | null> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return null;
  }
  const adminUser = data.users.find((u) => u.email === testUserEmail);
  const managerUser = data.users.find((u) => u.email === 'manager@alice.dev');
  return { adminUser, managerUser };
}

async function deleteTestWorkItems(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('work_items')
    .delete()
    .or('title.like.Issue E2E %,title.like.Work Item E2E %');

  if (error) {
    console.error('Error cleaning up test work items:', error);
  } else {
    console.log('Successfully cleaned up old test work items');
  }
}

async function deleteTestSprints(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('sprints')
    .delete()
    .or('name.like.Sprint E2E %,name.like.Admin Sprint %,name.like.Test %');

  if (error) {
    console.error('Error cleaning up test sprints:', error);
  } else {
    console.log('Successfully cleaned up old test sprints');
  }
}

async function updateProjectOwner(
  supabase: SupabaseClient,
  ownerId: string,
  isRestore: boolean
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ owner_id: ownerId })
    .eq('key', 'ALICE');

  if (error) {
    if (isRestore) {
      console.error('Error restoring project owner:', error);
    } else {
      console.error('Error setting project owner to admin:', error);
    }
    return;
  }

  if (isRestore) {
    console.log('Restored ALICE project owner to manager@alice.dev');
  } else {
    console.log('Set ALICE project owner to admin@alice.dev');
  }
}

async function cleanTestSprints(options?: { restoreOwner?: boolean }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testUserEmail = process.env.CYPRESS_TEST_USER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !testUserEmail) {
    console.log(
      'Skipping database cleanup: Supabase URL, Service Role Key, or Test User Email missing in .env.local'
    );
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const users = await getSupabaseUsers(supabase, testUserEmail);
    if (!users) {
      return false;
    }

    if (!users.adminUser) {
      console.log(`Test user ${testUserEmail} not found in auth registry`);
      return false;
    }

    const { adminUser, managerUser } = users;

    await deleteTestWorkItems(supabase);
    await deleteTestSprints(supabase);

    const shouldRestoreOwner = !!(options?.restoreOwner && managerUser);
    const targetUser = shouldRestoreOwner ? managerUser : adminUser;

    await updateProjectOwner(supabase, targetUser.id, shouldRestoreOwner);
    return true;
  } catch (err) {
    console.error('Failed in resetTestUserPassword task:', err);
    return false;
  }
}

export default defineConfig({
  env: {
    TEST_USER_EMAIL: process.env.CYPRESS_TEST_USER_EMAIL,
    TEST_USER_PASSWORD: process.env.CYPRESS_TEST_USER_PASSWORD,
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    setupNodeEvents(on, config) {
      on('task', {
        cleanTestSprints,
      });
      return config;
    },
  },
});
