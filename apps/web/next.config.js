import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

await jiti.import('./lib/env/env');

const apiOrigin = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/types'],
  images: {
    remotePatterns: [
      new URL('https://lh3.googleusercontent.com/**'),
      // Public Storage objects (profile pictures, etc.)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/edit-profile',
        destination: '/settings?tab=general',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
