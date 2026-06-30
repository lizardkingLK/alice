import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

import { env } from './env.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_INSTRUMENTS = [
  'violin',
  'viola',
  'cello',
  'double bass',
] as const;

async function seedInstruments(): Promise<void> {
  for (const name of DEFAULT_INSTRUMENTS) {
    const { data: existing } = await supabase
      .from('instruments')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error } = await supabase.from('instruments').insert({ name });

    if (error) {
      throw new Error(`Failed to seed instrument "${name}": ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  await seedInstruments();
  console.log('info. seed completed.');
}

main().catch((error: unknown) => {
  console.error('error. seed failed.', error);
  process.exit(1);
});
