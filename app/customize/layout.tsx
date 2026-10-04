import type { ReactNode } from 'react';
import { cakeScript } from '@/lib/cake/font';

export default function CustomizeLayout({ children }: { children: ReactNode }) {
  return <div className={cakeScript.variable}>{children}</div>;
}
