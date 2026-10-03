import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { BrandLoader } from '@/components/layout/brand-loader';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { FeedbackProvider } from '@/components/providers/feedback-provider';
import { StoreProvider } from '@/components/providers/store-provider';
import { site } from '@/data/site';
import './globals.css';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const ui = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: site.name, title: `${site.name} · ${site.tagline}`, description: site.description, locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#FFFFFF', width: 'device-width', initialScale: 1 };

// Runs before first paint: returning sessions and reduced-motion visitors skip the loader.
const introScript = `try{if(sessionStorage.getItem('tresor:intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.intro='seen'}catch(e){document.documentElement.dataset.intro='seen'}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${ui.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <StoreProvider>
          <FeedbackProvider>
            <BrandLoader />
            <Header />
            <div id="main" className="site-main">{children}</div>
            <Footer />
          </FeedbackProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
