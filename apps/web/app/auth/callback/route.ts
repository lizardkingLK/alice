import { NextResponse } from 'next/server';
import { resolveSafeRedirectPath } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

function buildRedirectUrl(request: Request, path: string): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  if (isLocalEnv) {
    return `${origin}${path}`;
  }

  if (forwardedHost) {
    return `https://${forwardedHost}${path}`;
  }

  return `${origin}${path}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = resolveSafeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(request, next));
    }
  }

  const isRecoveryFlow = next === '/reset-password';
  const errorPath = isRecoveryFlow
    ? '/forgot-password?error=expired'
    : '/login?error=Could not authenticate session';

  return NextResponse.redirect(buildRedirectUrl(request, errorPath));
}
