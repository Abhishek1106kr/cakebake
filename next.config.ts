import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Lets a test build live beside the dev server's .next (NEXT_DIST_DIR=.next-test).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // A stray lockfile higher up (C:\Users\chauh) confuses root detection.
  outputFileTracingRoot: __dirname,
  // Demonstration deployment: no indexing anywhere (a request to compliant crawlers, not a
  // security boundary), and admin pages are never cached by browsers or intermediaries.
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' }] },
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
      { source: '/admin', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
    ];
  },
};
export default nextConfig;
