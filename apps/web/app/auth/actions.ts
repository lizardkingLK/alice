'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { buildAuthCallbackUrl, getAuthOrigin } from '@/lib/auth-redirect';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { createClient } from '@/lib/supabase/server';

const requestPasswordResetSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address.' }),
});

export async function login(formData: FormData) {
  const supabase = await createClient();

  const emailEntry = formData.get('email');
  const passwordEntry = formData.get('password');

  const email = typeof emailEntry === 'string' ? emailEntry : '';
  const password = typeof passwordEntry === 'string' ? passwordEntry : '';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  console.log(error);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error: profileError } = await ensurePublicUser(user);
    if (profileError) {
      const errorContent = `Could not create user profile: ${profileError}`;
      redirect(`/login?error=${encodeURIComponent(errorContent)}`);
    }
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const emailEntry = formData.get('email');
  const passwordEntry = formData.get('password');

  const email = typeof emailEntry === 'string' ? emailEntry : '';
  const password = typeof passwordEntry === 'string' ? passwordEntry : '';

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
