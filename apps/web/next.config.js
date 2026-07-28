import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

await jiti.import('./lib/env/env');

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
};

export default nextConfig;
