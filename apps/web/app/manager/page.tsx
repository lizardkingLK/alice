import { redirect } from 'next/navigation';

/** Team management moved to /projects/[id]?tab=teams */
export default function ManagerDashboardPage() {
  redirect('/projects');
}
