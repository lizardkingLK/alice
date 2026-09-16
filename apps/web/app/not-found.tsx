import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/_components/not-found-content';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundContent />;
}
