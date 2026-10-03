import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The project lives inside OneDrive\Desktop, which has other lockfiles above it.
  turbopack: { root: __dirname },
};

export default nextConfig;
