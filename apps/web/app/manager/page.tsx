import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';

export default async function ManagerDashboard() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // TODO: enforce custom RBAC role check once application roles are stored in the database.

  return <h1>Manager Dashboard</h1>;
}
