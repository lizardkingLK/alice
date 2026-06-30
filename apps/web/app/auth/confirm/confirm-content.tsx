'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { Loader2, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';

export default function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') ?? 'invite';
  const next = searchParams.get('next') ?? '/reset-password';

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleVerify = () => {
    if (!tokenHash) {
      setError('Verification token is missing or invalid.');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        });

        if (verifyError) {
          setError(verifyError.message);
          return;
        }

        setSuccess(true);
        setTimeout(() => {
          router.push(next);
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred during verification.');
      }
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-6">
      <Card className="border-border bg-card/60 backdrop-blur-md w-full max-w-md shadow-2xl transition-all duration-300">
        <CardHeader className="space-y-1.5 pb-4 text-center">
          <div className="mx-auto bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 shadow-sm mb-2">
            <ShieldCheck className="h-6 w-6 animate-pulse" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight">
            Confirm Invitation
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm max-w-xs mx-auto">
            Verify your workspace invitation to set up your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {
          !tokenHash ? (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Invalid or expired verification link. Please request a new invite.</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success ? (
                <div className="text-emerald-500 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Verification successful! Redirecting...</span>
                </div>
              ) : (
                <button
                  disabled={isPending}
                  onClick={handleVerify}
                  className="w-full cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold h-11 rounded-md shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin animate-bounce" />
                      Verifying...
                    </>
                  ) : (
                    'Confirm & Continue'
                  )}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
