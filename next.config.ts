import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // A stray lockfile higher up (C:\Users\chauh) confuses root detection.
  outputFileTracingRoot: __dirname,
};
export default nextConfig;
