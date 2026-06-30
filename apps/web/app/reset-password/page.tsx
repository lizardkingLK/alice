'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { resetPassword, ResetState } from './actions';
import { KeyRound, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const initialState: ResetState = {
  success: false,
  error: null,
};

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(resetPassword, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-6">
      <div 
      className="border-border bg-card/60 backdrop-blur-md w-full max-w-md space-y-6 rounded-2xl border p-8 shadow-2xl transition-all duration-300">
        <div className="space-y-2 text-center">
          <div className="mx-auto bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 shadow-sm">
            <KeyRound className="h-6 w-6 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Set New Password</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Choose a strong password to secure your workspace account.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="bg-background/80 focus-visible:ring-primary h-11 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              className="bg-background/80 focus-visible:ring-primary h-11 transition-colors"
            />
          </div>

          {state.error && (
            <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {state.success && (
            <div className="text-emerald-500 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-2 rounded-lg border p-3.5 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Password updated! Redirecting...</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending || state.success}
            className="w-full cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all duration-300"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              'Set Password & Log In'
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
