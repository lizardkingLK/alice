import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

await jiti.import('./lib/env');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui'],
};

export default nextConfig;
