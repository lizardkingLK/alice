'use server';

import { redirect } from 'next/navigation';
import { contactRequestSchema } from '@repo/types';
import { getAPIUrl } from '@/lib/api/api';

export async function submitContact(formData: FormData) {
  const emailEntry = formData.get('email');
  const nameEntry = formData.get('name');
  const titleEntry = formData.get('title');
  const messageEntry = formData.get('message');

  const input = {
    email: typeof emailEntry === 'string' ? emailEntry : '',
    name: typeof nameEntry === 'string' && nameEntry ? nameEntry : undefined,
    title:
      typeof titleEntry === 'string' && titleEntry ? titleEntry : undefined,
    message: typeof messageEntry === 'string' ? messageEntry : '',
  };

  const parsed = contactRequestSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid input';
    redirect(`/contact?error=${encodeURIComponent(firstIssue)}`);
  }

  const apiUrl = getAPIUrl();
  if (!apiUrl) {
    redirect(`/contact?error=${encodeURIComponent('API unavailable')}`);
  }

  const response = await fetch(`${apiUrl}/api/notifications/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    const data: { error?: unknown } = await response
      .json()
      .catch(() => ({}) as { error?: unknown });

    const message =
      typeof data?.error === 'string' ? data.error : 'Request failed';
    redirect(`/contact?error=${encodeURIComponent(message)}`);
  }

  redirect('/contact?sent=1');
}
