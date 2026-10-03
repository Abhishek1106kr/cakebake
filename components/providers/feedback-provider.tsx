'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { Product } from '@/data/products';
import { ArtDrawing, toneClass } from '@/components/media/product-art';
import { EASE } from '@/lib/motion/transitions';

type Flight = { id: number; product: Product; from: DOMRect; to: DOMRect };
type Toast = { id: number; message: string; href?: string; action?: string };

type Feedback = {
  /** Sends a miniature of the product from `source` into the bag icon. */
  flyToBag: (source: HTMLElement | null, product: Product) => void;
  toast: (message: string, link?: { href: string; label: string }) => void;
};

const FeedbackContext = createContext<Feedback | null>(null);
const FLIGHT_SIZE = 64;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [toastState, setToastState] = useState<Toast | null>(null);
  const nextId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flyToBag = useCallback((source: HTMLElement | null, product: Product) => {
    if (reduce || !source) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-bag-target]')).find((el) => el.offsetParent !== null);
    if (!target) return;
    const flight: Flight = { id: (nextId.current += 1), product, from: source.getBoundingClientRect(), to: target.getBoundingClientRect() };
    setFlights((current) => [...current, flight]);
  }, [reduce]);

  const toast = useCallback((message: string, link?: { href: string; label: string }) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ id: (nextId.current += 1), message, href: link?.href, action: link?.label });
    toastTimer.current = setTimeout(() => setToastState(null), 2800);
  }, []);

  return (
    <FeedbackContext.Provider value={{ flyToBag, toast }}>
      {children}
      <div className="flight-layer" aria-hidden="true">
        {flights.map((flight) => {
          const startX = flight.from.left + flight.from.width / 2 - FLIGHT_SIZE / 2;
          const startY = flight.from.top + flight.from.height / 2 - FLIGHT_SIZE / 2;
          const endX = flight.to.left + flight.to.width / 2 - FLIGHT_SIZE / 2;
          const endY = flight.to.top + flight.to.height / 2 - FLIGHT_SIZE / 2;
          const lift = Math.min(startY, endY) - 80;
          return (
            <motion.div
              key={flight.id}
              className={`flight ${toneClass[flight.product.tone]}`}
              initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
              animate={{ x: [startX, (startX + endX) / 2, endX], y: [startY, lift, endY], scale: [1, 0.8, 0.28], opacity: [1, 1, 0.6] }}
              transition={{ duration: 0.62, ease: EASE, times: [0, 0.45, 1] }}
              onAnimationComplete={() => setFlights((current) => current.filter((f) => f.id !== flight.id))}
            >
              <ArtDrawing art={flight.product.art} />
            </motion.div>
          );
        })}
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        <AnimatePresence>
          {toastState && (
            <motion.div
              key={toastState.id}
              className="toast"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              <span>{toastState.message}</span>
              {toastState.href && <Link href={toastState.href} className="toast-action">{toastState.action}</Link>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return feedback;
}
