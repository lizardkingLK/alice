import { redirect } from 'next/navigation';
import { getDbUser, getUser } from '../../lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@repo/types';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { UserRegistry } from '@/app/users/_components/user-registry';

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
