// Site-wide password for the client preview (HTTP Basic Auth). Runs on Vercel before anything is
// served: pages, API routes and every file in public/, photos included. Off unless SITE_PASSWORD
// is set, so local development is unaffected. The username is SITE_USERNAME (default "client").
// This protects a private preview; it is not account security.

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const username = process.env.SITE_USERNAME || 'client';
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(header.slice(6)); } catch { decoded = ''; }
    const sep = decoded.indexOf(':');
    if (sep >= 0 && same(decoded.slice(0, sep), username) && same(decoded.slice(sep + 1), password)) return NextResponse.next();
  }
  return new NextResponse('Tresor demo preview: sign in with the username and password you were given.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Tresor demo preview", charset="UTF-8"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet' },
  });
}

/** Compares without stopping at the first difference (no early exit on length either). */
function same(a: string, b: string) {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// Everything except Next's own build assets (scripts and styles carry no content).
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
