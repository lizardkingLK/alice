import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';
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
        async cleanTestSprints() {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const testUserEmail = process.env.CYPRESS_TEST_USER_EMAIL;

          if (!supabaseUrl || !serviceRoleKey || !testUserEmail) {
            console.log('Skipping database cleanup: Supabase URL, Service Role Key, or Test User Email missing in .env.local');
            return null;
          }

          const supabase = createClient(supabaseUrl, serviceRoleKey);

          try {
            const { data, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) {
              console.error('Error listing users:', listError);
              return null;
            }

            const hasUser = data.users.some((u) => u.email === testUserEmail);
            if (hasUser) {

              // Clean up Cypress-created sprints to prevent list/pagination pollution
              const { error: deleteError } = await supabase
                .from('sprints')
                .delete()
                .or('name.like.Sprint E2E %,name.like.Admin Sprint %,name.like.Test %');
              
              if (deleteError) {
                console.error('Error cleaning up test sprints:', deleteError);
              } else {
                console.log('Successfully cleaned up old test sprints');
              }
            } else {
              console.log(`Test user ${testUserEmail} not found in auth registry`);
            }
          } catch (err) {
            console.error('Failed in resetTestUserPassword task:', err);
          }

          return null;
        },
      });
      return config;
    },
  },
});
