import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const projRes = await supabase
    .from('projects')
    .select('*, members:project_members(*)');
  
  console.log('--- PROJECTS FROM DATABASE ---');
  console.log(JSON.stringify(projRes.data, null, 2));
}

try {
  await check();
} catch (err) {
  console.error(err);
}
