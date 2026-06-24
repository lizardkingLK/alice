// export default function ManagerDashboard() {
//   return <h1>Manager Dashboard</h1>;
// }

import { redirect } from 'next/navigation';
import { getUserRole } from '../../lib/auth';

export default async function ManagerDashboard() {
  const role = await getUserRole();

  if (role !== 'manager') {
    redirect('/');
  }

  return <h1>Manager Dashboard</h1>;
}
