import { redirect } from 'next/navigation';
import { getUser, getDbUser } from '../../lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { createClient } from '@/lib/supabase/server';
import { UserRegistry } from './user-registry';
import type { Tables } from '@repo/types';

type DbUser = Tables<'users'>;

export default async function UsersDashboard() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const dbUser = await getDbUser();
  const currentUserRole = dbUser?.role ?? 'member';

  const supabase = await createClient();
  const { data: dbUsers, error } = await supabase
    .from('users')
    .select()
    .order('created_at', { ascending: false });

  if (error) {
    console.error('error. supabase database error:', error.message);
  }

  const usersList: DbUser[] = dbUsers ?? [];

  return (
    <DashboardShell
      title="Users"
      description="Manage application users, assign workspace roles, and control access."
      user={user}
    >
      <div className="w-full">
        <UserRegistry
          users={usersList}
          currentUserId={user.id}
          currentUserRole={currentUserRole}
        />
      </div>
    </DashboardShell>
  );
}
