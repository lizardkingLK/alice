import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { createClient } from '../../lib/db';

function InstrumentsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

async function InstrumentsData() {
  const supabase = createClient;
  
  const { data: instruments } = await supabase.from('instruments').select();

  return <pre>{JSON.stringify(instruments, null, 2)}</pre>;
}

export default async function InstrumentsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  return (
    <DashboardShell
      title="Instruments"
      description="Track your favourite instruments."
    >
      <Suspense fallback={<InstrumentsSkeleton />}>
        <InstrumentsData />
      </Suspense>
    </DashboardShell>
  );
}
