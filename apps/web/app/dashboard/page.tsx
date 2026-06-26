import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground text-sm">Signed in as {user.email}</p>
    </main>
  );
}
