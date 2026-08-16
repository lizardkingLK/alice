import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { FileQuestion } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { appTitle } from '@/app/_shared/values';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center p-6">
      <div
        className={cn(
          'border-border w-full max-w-md space-y-6 rounded-xl border p-8',
          'flex flex-col items-center text-center'
        )}
      >
        <div
          className={cn(
            'bg-muted text-muted-foreground flex size-14 items-center justify-center',
            'rounded-2xl'
          )}
          aria-hidden
        >
          <FileQuestion className="size-7" />
        </div>
        <div className="space-y-2">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-muted-foreground text-sm">
            This URL does not exist, or the page was moved. Head back to{' '}
            {appTitle} home to keep going.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
