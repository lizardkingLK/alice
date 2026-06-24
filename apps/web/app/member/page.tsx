// export default function MemberDashboard() {
//   return <h1>Member Dashboard</h1>;
// }

import { redirect } from 'next/navigation';
import { getUserRole } from '../../lib/auth';

export default async function MemberDashboard() {
  const role = await getUserRole();

  if (role !== 'member') {
    redirect('/');
  }

  return <h1>Member Dashboard</h1>;
}
