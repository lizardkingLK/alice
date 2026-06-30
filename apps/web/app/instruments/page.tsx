import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import type { Tables } from '@repo/types';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Instrument = Tables<'instruments'>;

function InstrumentsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-48 w-48" />
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
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell
      title="Instruments"
      description="Track your favourite instruments."
      user={user}
    >
      <Suspense fallback={<InstrumentsSkeleton />}>
        <InstrumentsData />
      </Suspense>
    </DashboardShell>
  );
}
