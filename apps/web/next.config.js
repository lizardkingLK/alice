import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

await jiti.import('./lib/env/env');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/types'],
  images: {
    remotePatterns: [new URL('https://lh3.googleusercontent.com/**')],
  },
  output: 'standalone',
};

export default nextConfig;
