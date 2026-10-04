'use client';

// Smooth, inertial wheel/trackpad scrolling (Lenis). The page still scrolls
// natively underneath, so Framer's useScroll scenes and sticky sections work as
// before. Off for reduced motion, touch-first devices and the admin, and paused
// whenever something locks the page (search sheet, dialogs).

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

export function SmoothScroll() {
  const pathname = usePathname();
  const lenis = useRef<Lenis | null>(null);
  const admin = pathname?.startsWith('/admin') ?? false;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || touch || admin) return;
    const instance = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      anchors: true,
      // Inner scroll areas (search sheet, menus) keep their own native scrolling.
      prevent: (node) => Boolean(node.closest?.('[data-lenis-prevent], .search-sheet, .added-sheet, select, textarea')),
    });
    lenis.current = instance;
    let raf = 0;
    const loop = (t: number) => { instance.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    // Pause while the page is locked (e.g. body overflow hidden by an overlay).
    const sync = () => (document.body.style.overflow === 'hidden' ? instance.stop() : instance.start());
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => { cancelAnimationFrame(raf); observer.disconnect(); instance.destroy(); lenis.current = null; };
  }, [admin]);

  // New page: start at the top immediately (unless jumping to an anchor).
  useEffect(() => {
    if (!window.location.hash) lenis.current?.scrollTo(0, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
