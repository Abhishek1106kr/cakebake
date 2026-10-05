import type { ReactNode } from 'react';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { MockAdminAuthGate } from '@/components/admin/mock-auth-gate';
import './admin.css';

// Admin-only fonts: Cormorant Garamond for headings, Inter for the interface.
const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--ad-display', display: 'swap' });
const ui = Inter({ subsets: ['latin'], variable: '--ad-ui', display: 'swap' });

export const metadata = { title: 'Tresor · Command centre', robots: { index: false, follow: false, noarchive: true, nosnippet: true } };

// AdminLayout → MockAdminAuthGate (demo sign-in) → AdminShell → AdminProvider → pages.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <MockAdminAuthGate className={`${display.variable} ${ui.variable}`}>{children}</MockAdminAuthGate>;
}
