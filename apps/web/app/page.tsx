import { getUser } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { AuthControls } from '@/app/dashboard/_components/dashboard-auth';
import { HomeCta } from '@/app/_components/home/home-cta';
import { HomeFeatures } from '@/app/_components/home/home-features';
import { HomeFooter } from '@/app/_components/home/home-footer';
import { HomeHowItWorks } from '@/app/_components/home/home-how-it-works';
import './globals.css';

type HomeProps = {
  searchParams: Promise<{ reset?: string }>;
};

export default async function Home({ searchParams }: Readonly<HomeProps>) {
  const user = await getUser();

  const { reset } = await searchParams;
  const resetSuccess = reset === 'success';

  return (
    <main className="h-dvh snap-y snap-mandatory overflow-y-auto">
      <section className="relative flex min-h-dvh snap-start snap-always flex-col items-center justify-center px-6">
        <div className="absolute top-0 right-0 p-4">
          <AuthControls email={user?.email} />
        </div>
        {resetSuccess ? (
          <output className="absolute top-16 text-sm text-emerald-600">
            Password updated. Sign in with your new password.
          </output>
        ) : null}
        <div>
          <h1 className="text-8xl font-bold">Jira Teams</h1>
          <h2 className="text-center text-4xl">A Jira Clone</h2>
        </div>
        <div className="flex gap-4 p-4">
          <Button asChild className="cursor-pointer">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </section>

      <HomeFeatures />
      <HomeHowItWorks />
      <HomeCta isSignedIn={Boolean(user)} />
      <HomeFooter />
    </main>
  );
}
