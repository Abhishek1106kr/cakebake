import './globals.css';
import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { LOCAL_MEDIA } from '@/lib/local-media';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProvider } from '@/components/store-provider';
import { TransitionProvider } from '@/components/transitions';
import { PageViewTracker } from '@/components/intelligence';
import { cakeScript } from '@/lib/cake/font';
import { SmoothScroll } from '@/components/smooth-scroll';
import { HideOnAdmin } from '@/components/hide-on-admin';
import { AnnouncementBar } from '@/components/announcement-bar';
import { MockSiteWarning } from '@/components/mock-site-warning';
import 'lenis/dist/lenis.css';

// Demonstration deployment: ask compliant crawlers not to index, follow, archive or snippet
// anything (also sent as an X-Robots-Tag header, see next.config.ts). Not a security boundary.
export const metadata: Metadata = {
  title: 'Tresor Bakery — pastry, cakes & slow rituals',
  description: 'A premium neighbourhood bakery in Bengaluru. Demonstration website.',
  robots: {
    index: false, follow: false, noarchive: true, nosnippet: true,
    googleBot: { index: false, follow: false, noarchive: true, nosnippet: true },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cakeScript.variable} data-scroll-behavior="smooth">
      <head>
        {/* Local photos (git-ignored public/mock-assets): dev server, or a deployment made with them (NEXT_PUBLIC_LOCAL_MEDIA=1). */}
        {LOCAL_MEDIA && <link rel="stylesheet" href="/mock-assets/mock.css" />}
      </head>
      <body>
        <StoreProvider>
          <PageViewTracker />
          <SmoothScroll />
          <TransitionProvider>
            <HideOnAdmin><AnnouncementBar /><StoreHeader /></HideOnAdmin>
            {children}
            <HideOnAdmin><StoreFooter /></HideOnAdmin>
          </TransitionProvider>
        </StoreProvider>
        <MockSiteWarning />
      </body>
    </html>
  );
}
