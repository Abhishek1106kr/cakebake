import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { StoreProvider } from '@/components/store';

export const metadata = {
  title: 'Tresor — Good Coffee. Slow Moments.',
  description: 'A contemporary bakery from Tresor, Bengaluru.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><StoreProvider><Header />{children}<div className="page"><Footer /></div></StoreProvider></body></html>;
}
