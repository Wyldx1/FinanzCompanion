/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@finanz/db'],
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
};

export default nextConfig;
