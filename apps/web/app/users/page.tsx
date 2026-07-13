import { getDbUser } from '../../lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { UserRegistry } from '@/app/users/_components/user-registry';
import { DbUser } from '@/app/users/_services/users.service';

export default async function UsersDashboard() {
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
    <DashboardShell description="Manage application users, assign workspace roles, and control access.">
      <div className="w-full">
        <UserRegistry
          users={usersList}
          currentUserId={dbUser?.id}
          currentUserRole={currentUserRole}
        />
      </div>
    </DashboardShell>
  );
}
