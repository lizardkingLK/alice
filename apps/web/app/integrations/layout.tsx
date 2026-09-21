import type { ReactNode } from 'react';

/**
 * OAuth return pages and integration landings.
 * Renders the OAuth completion landings for popup/redirect flows.
 */
export default function IntegrationsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <section>{children}</section>;
}
