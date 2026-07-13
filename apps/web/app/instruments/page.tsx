import { Suspense } from 'react';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import type { Tables } from '@repo/types';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

type Instrument = Tables<'instruments'>;

function InstrumentsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

async function InstrumentsData() {
  const supabase = await createClient();

  const { data: instruments, error } = await supabase
    .from('instruments')
    .select();

  if (error) {
    console.error('error. supabase database error:', error.message);
    return <p>Error loading data: {error.message}</p>;
  }

  const rows: Instrument[] = instruments ?? [];

  return <pre>{JSON.stringify(rows, null, 2)}</pre>;
}

export default async function InstrumentsPage() {
  return (
    <DashboardShell description="Track your favourite instruments.">
      <Suspense fallback={<InstrumentsSkeleton />}>
        <InstrumentsData />
      </Suspense>
    </DashboardShell>
  );
}
