'use server';

import { redirect } from 'next/navigation';
import { contactRequestSchema } from '@repo/types';
import { getAPIUrl } from '@/lib/api/api-fetch.helper';

function safeContactReturnPath(
  returnTo: FormDataEntryValue | null
): '/contact' | '/access-denied' {
  return returnTo === '/access-denied' ? '/access-denied' : '/contact';
}

export async function submitContact(formData: FormData) {
  const emailEntry = formData.get('email');
  const nameEntry = formData.get('name');
  const titleEntry = formData.get('title');
  const subjectOtherEntry = formData.get('subjectOther');
  const messageEntry = formData.get('message');
  const projectKeysEntry = formData.get('requestedProjectKeys');
  const returnPath = safeContactReturnPath(formData.get('returnTo'));

  const titleFromSelect =
    typeof titleEntry === 'string' ? titleEntry.trim() : '';
  const titleFromOther =
    typeof subjectOtherEntry === 'string' ? subjectOtherEntry.trim() : '';

  const input = {
    email: typeof emailEntry === 'string' ? emailEntry : '',
    name: typeof nameEntry === 'string' && nameEntry ? nameEntry : undefined,
    title: titleFromSelect || titleFromOther || undefined,
    message: typeof messageEntry === 'string' ? messageEntry : '',
    requestedProjectKeys:
      typeof projectKeysEntry === 'string' && projectKeysEntry.trim()
        ? projectKeysEntry
        : undefined,
  };

  const parsed = contactRequestSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid input';
    redirect(`${returnPath}?error=${encodeURIComponent(firstIssue)}`);
  }

  const apiUrl = getAPIUrl();
  if (!apiUrl) {
    redirect(`${returnPath}?error=${encodeURIComponent('API unavailable')}`);
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
    redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
  }

  redirect(`${returnPath}?sent=1`);
}
