import { AuthControls } from '@/components/auth/auth-controls';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import './globals.css';

type HomeProps = {
  searchParams: Promise<{ reset?: string }>;
};

export default async function Home({ searchParams }: Readonly<HomeProps>) {
  const user = await getUser();
  const { reset } = await searchParams;
  const resetSuccess = reset === 'success';

  return (
    <main className="flex h-[calc(100vh)] flex-col items-center justify-center">
      <section className="absolute top-0 right-0 p-4">
        <AuthControls email={user?.email} />
      </section>
      {resetSuccess ? (
        <output className="absolute top-16 text-sm text-emerald-600">
          Password updated. Sign in with your new password.
        </output>
      ) : null}
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
