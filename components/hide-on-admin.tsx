'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** The admin has its own shell; shop chrome (header, footer) stays on the customer site. */
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname?.startsWith('/admin') ? null : <>{children}</>;
}
