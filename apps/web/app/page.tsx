import { AuthControls } from '@/components/auth/auth-controls';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { HashHandler } from './hash-handler';
import './globals.css';

export default async function Home() {
  const user = await getUser();

  return (
    <main className="flex h-[calc(100vh)] flex-col items-center justify-center">
      <HashHandler />
      <section className="absolute top-0 right-0 p-4">
        <AuthControls email={user?.email} />
      </section>
      <section>
        <h1 className="text-8xl font-bold">Jira Teams</h1>
        <h2 className="text-center text-4xl">A Jira Clone</h2>
      </section>
      <section className="flex gap-4 p-4">
        <Button asChild className="cursor-pointer">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
