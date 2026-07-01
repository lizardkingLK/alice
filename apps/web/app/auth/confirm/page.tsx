import { Suspense } from 'react';
import ConfirmContent from './confirm-content';

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="from-background via-muted/50 to-background flex min-h-screen items-center justify-center bg-linear-to-br p-6">
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-sm">Loading verification...</p>
          </div>
        </main>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
