'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function HashHandler() {
  const router = useRouter();

  useEffect(() => {
    if (globalThis.window !== undefined) {
      const hash = globalThis.window.location.hash;
      let hasRedirected = false;

      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const type = params.get('type');

        if (accessToken && (type === 'invite' || type === 'recovery')) {
          router.push('/reset-password');
          hasRedirected = true;
        }
      }

      if (!hasRedirected) {
        router.push('/dashboard');
      }
    }
  }, [router]);

  return null;
}
