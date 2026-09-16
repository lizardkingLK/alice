'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { FileQuestion } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { appTitle } from '@/app/_shared/values';
import { createClient } from '@/lib/supabase/client';
import { removeFavorite } from '@/lib/favorites/favorites-storage';

function NotFoundFavoriteMessage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [removedLabel, setRemovedLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function clearStaleFavorite() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }

      const result = removeFavorite(user.id, pathname, searchParams.toString());
      if (result.removed && !cancelled) {
        setRemovedLabel(result.label);
      }
    }

    void clearStaleFavorite();
    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams]);

  if (!removedLabel) {
    return (
      <p className="text-muted-foreground text-sm">
        This URL does not exist, or the page was moved. Head back to {appTitle}{' '}
        home to keep going.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      This page is no longer available, so{' '}
      <span className="text-foreground font-medium">{removedLabel}</span> was
      removed from your favorites.
    </p>
  );
}

export function NotFoundContent() {
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
          <Suspense
            fallback={
              <p className="text-muted-foreground text-sm">
                This URL does not exist, or the page was moved. Head back to{' '}
                {appTitle} home to keep going.
              </p>
            }
          >
            <NotFoundFavoriteMessage />
          </Suspense>
        </div>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
