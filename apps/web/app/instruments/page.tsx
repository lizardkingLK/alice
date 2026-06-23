import { createClient } from '../../utils/supabase/client';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

async function InstrumentsData() {
  const supabase = createClient();
  const { data: instruments } = await supabase.from('instruments').select();

  return <pre>{JSON.stringify(instruments, null, 2)}</pre>;
}

export default function Instruments() {
  return (
    <Suspense fallback={<div>Loading instruments...</div>}>
      <InstrumentsData />
    </Suspense>
  );
}
