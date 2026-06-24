// export default function AdminDashboard() {
//   return <h1>Admin Dashboard</h1>;
// }

import { redirect } from 'next/navigation';
import { getUserRole } from '../../lib/auth';

export default async function AdminDashboard() {
  const role = await getUserRole();

  if (role !== 'admin') {
    redirect('/');
  }

  return <h1>Admin Dashboard</h1>;
}
