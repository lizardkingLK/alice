'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();

 const emailEntry = formData.get('email');
const passwordEntry = formData.get('password');

const email = typeof emailEntry === 'string' ? emailEntry : '';
const password = typeof passwordEntry === 'string' ? passwordEntry : '';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
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

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
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
