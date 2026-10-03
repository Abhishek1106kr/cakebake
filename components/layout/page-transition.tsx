'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { EASE, EASE_IN_OUT } from '@/lib/motion/transitions';

// Rendered from app/template.tsx, which remounts on every navigation.
// The first page load gets the brand loader instead of the veil.
let isFirstMount = true;

function routeLabel(pathname: string): string | null {
  if (pathname === '/') return null;
  if (pathname.startsWith('/menu') || pathname.startsWith('/product')) return 'Menu';
  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) return 'Your order';
  if (pathname.startsWith('/order') || pathname.startsWith('/track')) return 'Order';
  if (pathname.startsWith('/about')) return 'The house';
  if (pathname.startsWith('/contact')) return 'Visit';
  if (pathname.startsWith('/account')) return 'Account';
  return null;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const firstMount = isFirstMount;

  useEffect(() => { isFirstMount = false; }, []);

  if (firstMount) return <>{children}</>;

  if (reduce) {
    return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>{children}</motion.div>;
  }

  const label = routeLabel(pathname);
  return (
    <>
      <motion.div
        className="page-veil"
        aria-hidden="true"
        initial={{ y: '0%' }}
        animate={{ y: '-100%' }}
        transition={{ duration: 0.45, delay: 0.12, ease: EASE_IN_OUT }}
      >
        <motion.div className="veil-label" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.18, delay: 0.1 }}>
          <span>Tresor</span>
          {label && <strong>{label}</strong>}
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18, ease: EASE }}>
        {children}
      </motion.div>
    </>
  );
}
