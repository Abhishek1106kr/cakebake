'use client';

// One-time notice that this is a demonstration site. Shown on the first visit in a browser
// (any page, the admin included) until acknowledged. If browser storage is unavailable the
// notice still shows and can be dismissed for this page view; the site keeps working.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const DEMO_WARNING_KEY = 'tresor-demo-warning-seen';

function alreadySeen(): boolean {
  try { return window.localStorage.getItem(DEMO_WARNING_KEY) !== null; } catch { return false; }
}

export function MockSiteWarning() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!alreadySeen()) setOpen(true); }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Everything else on the page is inert while the notice is up: no clicks, no tab stops,
    // and screen readers stay in the dialog. Body overflow pauses scrolling (and Lenis).
    const others = Array.from(document.body.children).filter((el) => el !== container.current);
    others.forEach((el) => el.setAttribute('inert', ''));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // The only control is the acknowledgement: Tab stays on it. Escape doesn't dismiss,
      // because the point of the notice is an explicit acknowledgement.
      if (e.key === 'Tab') { e.preventDefault(); button.current?.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      others.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  const acknowledge = () => {
    try { window.localStorage.setItem(DEMO_WARNING_KEY, JSON.stringify({ v: 1, at: new Date().toISOString() })); } catch { /* storage blocked: dismiss for this view */ }
    setOpen(false);
  };

  if (!open) return null;
  return createPortal(
    <div className="demo-warning-layer" data-lenis-prevent ref={container}>
      <div className="demo-warning" role="dialog" aria-modal="true" aria-labelledby="demo-warning-title" aria-describedby="demo-warning-body">
        <h2 id="demo-warning-title">Warning — demonstration environment</h2>
        <div id="demo-warning-body">
          <p>This is a mock / demonstration website.</p>
          <p>The data, authentication, orders, customer records, payments, invoices and automations shown here are demonstration functionality and must not be treated as production data.</p>
          <p><strong>Do not enter real personal, payment, business or customer information.</strong></p>
          <p>Automated scraping, crawling, copying, extraction or redistribution of this demonstration environment is not permitted.</p>
        </div>
        <button type="button" ref={button} className="demo-warning-ok" onClick={acknowledge}>I understand</button>
      </div>
    </div>,
    document.body,
  );
}
