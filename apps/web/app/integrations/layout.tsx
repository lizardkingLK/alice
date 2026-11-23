import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * OAuth / App-install return pages and integration landings.
 * Popup and redirect flows only — keep out of search indexes.
 */
export default function IntegrationsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <section>{children}</section>;
}
