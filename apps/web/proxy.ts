import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Keep brand metadata images public — transactional email embeds `/icon`
  // (and similar). Auth redirects break those fetches in mail clients.
  matcher: [
    `/((?!_next/static|_next/image|favicon.ico|icon(?:$|\\/)|apple-icon(?:$|\\/)|opengraph-image(?:$|\\/)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)`,
  ],
};
