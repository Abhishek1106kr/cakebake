import './globals.css';
import { ReactNode } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProvider } from '@/components/store-provider';
import { TransitionProvider } from '@/components/transitions';
import { PageViewTracker } from '@/components/intelligence';
import { cakeScript } from '@/lib/cake/font';
import { SmoothScroll } from '@/components/smooth-scroll';
import { HideOnAdmin } from '@/components/hide-on-admin';
import 'lenis/dist/lenis.css';

export const metadata = {
  title: 'Tresor Bakery — pastry, cakes & slow rituals',
  description: 'A premium neighbourhood bakery in Bengaluru.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cakeScript.variable}>
      <head>
        {/* Local mock imagery (git-ignored public/mock-assets). Dev only: production never loads it. */}
        {process.env.NODE_ENV === 'development' && <link rel="stylesheet" href="/mock-assets/mock.css" />}
      </head>
      <body>
        <StoreProvider>
          <PageViewTracker />
          <SmoothScroll />
          <TransitionProvider>
            <HideOnAdmin><StoreHeader /></HideOnAdmin>
            {children}
            <HideOnAdmin><StoreFooter /></HideOnAdmin>
          </TransitionProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
