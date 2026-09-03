import { redirect } from 'next/navigation';
import {
  buildAccessDeniedPath,
  evaluateEmailAdmission,
} from '@/lib/access-allowlist';

/** Redirect to access-denied when `email` fails admission (login/signup). */
export async function redirectUnlessEmailAdmitted(
  email: string
): Promise<void> {
  const admission = await evaluateEmailAdmission(email);
  if (!admission.allowed) {
    redirect(buildAccessDeniedPath(admission.reason));
  }
}
