import { baseUrl } from '@/app/_shared/values';
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/projects',
        '/manager',
        '/member',
        '/notifications',
        '/files',
        '/help',
        '/docs',
        '/roadmap',
        '/profile',
        '/settings',
        '/integrations',
        '/forgot-password',
        '/reset-password',
        '/charts',
        '/chat',
        '/notes',
        '/*?*',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
