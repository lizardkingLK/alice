import { NextResponse } from 'next/server';
import { resolveSafeRedirectPath } from '@/lib/auth-redirect';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@repo/types';

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && url && anonKey) {
    const redirectUrl = buildRedirectUrl(request, next);
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') ?? '';
          return cookieHeader.split(';').map((c) => {
            const [name, ...value] = c.trim().split('=');
            return { name: name?.trim() ?? '', value: value.join('=') };
          });
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await ensurePublicUser(user);
        if (profileError) {
          const errorContent = `Could not create user profile: ${profileError}`;
          const errorPath = `/login?error=${encodeURIComponent(errorContent)}`;
          return NextResponse.redirect(buildRedirectUrl(request, errorPath));
        }
      }

      return response;
    }
  }

  const isRecoveryFlow = next === '/reset-password';
  const errorPath = isRecoveryFlow
    ? '/forgot-password?error=expired'
    : '/login?error=Could not authenticate session';

  console.error('Error during authentication callback::::::', errorPath);

  return NextResponse.redirect(buildRedirectUrl(request, errorPath));
}
