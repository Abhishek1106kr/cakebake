import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Lets a test build live beside the dev server's .next (NEXT_DIST_DIR=.next-test).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // A stray lockfile higher up (C:\Users\chauh) confuses root detection.
  outputFileTracingRoot: __dirname,
};
export default nextConfig;
