import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  transpilePackages: ['@finanz/db'],
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
};

export default nextConfig;
