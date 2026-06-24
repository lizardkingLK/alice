import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  const client = await clerkClient();

  const user = await client.users.getUser(userId);

  const role = user.publicMetadata.role;

  if (role === 'admin') {
    redirect('/admin');
  }

  if (role === 'manager') {
    redirect('/manager');
  }

  redirect('/member');
}
