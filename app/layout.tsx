import './globals.css';
import { ReactNode } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProvider } from '@/components/store-provider';

export const metadata = {
  title: 'Tresor Bakery — pastry, cakes & slow rituals',
  description: 'A premium neighbourhood bakery in Bengaluru.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Local mock imagery (git-ignored public/mock-assets). Dev only: production never loads it. */}
        {process.env.NODE_ENV === 'development' && <link rel="stylesheet" href="/mock-assets/mock.css" />}
      </head>
      <body>
        <StoreProvider>
          <StoreHeader />
          {children}
          <StoreFooter />
        </StoreProvider>
      </body>
    </html>
  );
}
