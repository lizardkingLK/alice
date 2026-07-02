'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EmailOtpType } from '@supabase/supabase-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
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
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during verification.'
        );
      }
    });
  };

  return (
    <main className="from-background via-muted/50 to-background flex min-h-screen items-center justify-center bg-linear-to-br p-6">
      <Card className="border-border bg-card/60 w-full max-w-md shadow-2xl backdrop-blur-md transition-all duration-300">
        <CardHeader className="space-y-1.5 pb-4 text-center">
          <div className="bg-primary/10 text-primary border-primary/20 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm">
            <ShieldCheck className="h-6 w-6 animate-pulse" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight">
            Confirm Invitation
          </CardTitle>
          <CardDescription className="text-muted-foreground mx-auto max-w-xs text-sm">
            Verify your workspace invitation to set up your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tokenHash ? (
            <>
              {error && (
                <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-500">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Verification successful! Redirecting...</span>
                </div>
              ) : (
                <button
                  disabled={isPending}
                  onClick={handleVerify}
                  className="flex h-11 w-full cursor-pointer items-center justify-center rounded-md font-semibold text-white shadow-md transition-all duration-300"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Confirm & Continue'
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Invalid or expired verification link. Please request a new
                invite.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
