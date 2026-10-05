import type { MetadataRoute } from 'next';

// Demonstration deployment: compliant crawlers are asked to stay out entirely.
// robots.txt is a request, not a security boundary.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
