import type { ReactNode } from 'react';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { AdminShell } from '@/components/admin/shell';
import './admin.css';

// Admin-only fonts: Cormorant Garamond for headings, Inter for the interface.
const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--ad-display', display: 'swap' });
const ui = Inter({ subsets: ['latin'], variable: '--ad-ui', display: 'swap' });

export const metadata = { title: 'Tresor · Command centre', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell className={`${display.variable} ${ui.variable}`}>{children}</AdminShell>;
}
