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
        '/instruments',
        '/files',
        '/forgot-password',
        '/reset-password',
        '/*?*',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
