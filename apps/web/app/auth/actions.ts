'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  buildAuthCallbackUrl,
  buildLoginPath,
  resolveSafeRedirectPath,
} from '@/lib/auth-redirect';
import { getAuthOrigin } from '@/lib/auth-redirect.server';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { isEmailAllowed } from '@/lib/access-allowlist';
import { createClient } from '@/lib/supabase/server';

const requestPasswordResetSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address.' }),
});

export async function login(formData: FormData) {
  const supabase = await createClient();

  const emailEntry = formData.get('email');
  const passwordEntry = formData.get('password');
  const nextEntry = formData.get('next');

  const email = typeof emailEntry === 'string' ? emailEntry : '';
  const password = typeof passwordEntry === 'string' ? passwordEntry : '';
  const next = resolveSafeRedirectPath(
    typeof nextEntry === 'string' ? nextEntry : null
  );

  const allowed = await isEmailAllowed(email);
  if (!allowed) {
    redirect('/access-denied');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(
      buildLoginPath(next, {
        error: error.message,
      })
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error: profileError } = await ensurePublicUser(user);
    if (profileError) {
      const errorContent = `Could not create user profile: ${profileError}`;
      redirect(
        buildLoginPath(next, {
          error: errorContent,
        })
      );
    }
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const emailEntry = formData.get('email');
  const passwordEntry = formData.get('password');

  const email = typeof emailEntry === 'string' ? emailEntry : '';
  const password = typeof passwordEntry === 'string' ? passwordEntry : '';

  const allowed = await isEmailAllowed(email);
  if (!allowed) {
    redirect('/access-denied');
  }

  const origin = await getAuthOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(origin, '/dashboard');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    const { error: profileError } = await ensurePublicUser(data.user);
    if (profileError) {
      const errorContent = `Could not create user profile: ${profileError}`;
      redirect(`/signup?error=${encodeURIComponent(errorContent)}`);
    }
  }

  if (data.user && !data.session) {
    redirect('/signup?checkEmail=1');
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(formData: FormData) {
  const emailEntry = formData.get('email');
  const email = typeof emailEntry === 'string' ? emailEntry : '';

  const validation = requestPasswordResetSchema.safeParse({ email });
  if (!validation.success) {
    const message =
      validation.error.issues[0]?.message ?? 'Please enter a valid email.';
    redirect(`/forgot-password?error=${encodeURIComponent(message)}`);
  }

  const origin = await getAuthOrigin();
  const redirectTo = buildAuthCallbackUrl(origin, '/reset-password');

  const supabase = await createClient();
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    validation.data.email,
    { redirectTo }
  );

  if (resetError) {
    console.error(
      'error. password reset email request failed:',
      resetError.message
    );
  }

  redirect('/forgot-password?sent=1');
}
