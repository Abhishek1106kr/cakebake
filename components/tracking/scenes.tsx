'use client';

// One small scene per status. Geometric, warm, quiet: transforms and opacity only,
// continuous motion kept to a few CSS loops that stop under reduced motion.

import { motion } from 'framer-motion';
import type { Order } from '@/lib/orders';
import type { TrackingStatus } from '@/lib/tracking/status';
import { colors } from '@/lib/cake/config';
import { CakePreview } from '@/components/cake-studio/preview';
import { EASE } from '@/lib/motion';

const INK = '#202625';
const SAGE = '#7E9291';
const SAGE_D = '#657876';
const SAGE_L = '#A9B7B6';
const LINE = '#DDE3E1';
const CREAM = '#F4EBDD';
const WARM = '#E9A65B';

const enter = { initial: { opacity: 0, y: 14, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -10, scale: 0.98 }, transition: { duration: 0.6, ease: EASE } };

function cakeColor(order: Order | null): string {
  const custom = order?.items.find((l) => l.custom)?.custom?.config;
  return colors.find((c) => c.id === custom?.color)?.hex ?? CREAM;
}

function Ticket() {
  return (
    <g>
      <motion.g initial={{ rotate: -8, y: 20, opacity: 0 }} animate={{ rotate: -4, y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: EASE }} style={{ transformOrigin: '180px 140px' }}>
        <path d="M110 80 h140 a8 8 0 0 1 8 8 v24 a12 12 0 0 0 0 24 v56 a8 8 0 0 1 -8 8 h-140 a8 8 0 0 1 -8 -8 v-56 a12 12 0 0 0 0 -24 v-24 a8 8 0 0 1 8 -8z" fill="#fff" stroke={LINE} strokeWidth="1.5" />
        <line x1="112" y1="124" x2="248" y2="124" stroke={LINE} strokeWidth="1.5" strokeDasharray="4 5" />
        <text x="126" y="108" fontFamily="Georgia, serif" fontSize="18" fill={INK}>Tresor</text>
        {[146, 160, 174].map((y, i) => <rect key={y} x="126" y={y} width={[96, 72, 84][i]} height="6" rx="3" fill={i === 0 ? SAGE_L : LINE} />)}
      </motion.g>
      <path className="ts-spark" d="M262 74 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" fill={WARM} />
    </g>
  );
}

function Stamp() {
  return (
    <g>
      <motion.g initial={{ scale: 1.25, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} style={{ transformOrigin: '180px 140px' }}>
        <circle cx="180" cy="140" r="62" fill="none" stroke={SAGE_D} strokeWidth="2.5" />
        <circle cx="180" cy="140" r="52" fill="none" stroke={SAGE_D} strokeWidth="1" strokeDasharray="2 4" />
        <defs><path id="ts-ring" d="M180 140 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
        <text fontFamily="Inter, system-ui, sans-serif" fontSize="9" letterSpacing="3" fill={SAGE_D}><textPath href="#ts-ring">TRESOR · CONFIRMED · TRESOR · CONFIRMED ·</textPath></text>
        <motion.path d="M160 141 l13 13 27 -29" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.35, duration: 0.6, ease: EASE }} />
      </motion.g>
    </g>
  );
}

function Oven({ tint }: { tint: string }) {
  return (
    <g>
      {[150, 178, 206].map((x, i) => <path key={x} className="ts-steam" style={{ animationDelay: `${i * 0.7}s` }} d={`M${x} 70 c-8 -10 8 -18 0 -28`} fill="none" stroke={SAGE_L} strokeWidth="3" strokeLinecap="round" />)}
      <rect x="104" y="78" width="152" height="140" rx="14" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <circle cx="128" cy="96" r="6" fill={LINE} />
      <g className="ts-dial" style={{ transformOrigin: '232px 96px' }}><circle cx="232" cy="96" r="9" fill="none" stroke={SAGE} strokeWidth="1.5" /><line x1="232" y1="96" x2="232" y2="89" stroke={INK} strokeWidth="2" strokeLinecap="round" /></g>
      <rect x="122" y="116" width="116" height="84" rx="8" fill="#2E2A26" />
      <rect className="ts-glow" x="122" y="116" width="116" height="84" rx="8" fill={WARM} opacity="0.35" />
      <motion.g initial={{ scaleY: 0.6 }} animate={{ scaleY: 1 }} transition={{ duration: 2.4, ease: EASE }} style={{ transformOrigin: '180px 186px' }}>
        <rect x="150" y="162" width="60" height="24" rx="4" fill="#9A6B42" />
        <rect x="148" y="154" width="64" height="10" rx="5" fill={tint} />
      </motion.g>
      <line x1="132" y1="190" x2="228" y2="190" stroke="#57504A" strokeWidth="3" />
    </g>
  );
}

function Box({ open = false, order }: { open?: boolean; order: Order | null }) {
  const custom = order?.items.find((l) => l.custom)?.custom?.config;
  return (
    <g>
      <ellipse className={open ? undefined : 'ts-breathe'} cx="180" cy="214" rx="96" ry="12" fill={SAGE_L} opacity="0.35" />
      {open && (
        <motion.g initial={{ y: 30, opacity: 0, scale: 0.92 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 0.45, duration: 0.8, ease: EASE }} style={{ transformOrigin: '180px 150px' }}>
          {custom
            ? <svg x="110" y="58" width="140" height="140" viewBox="0 0 600 600"><CakePreview config={custom} title="Your cake" /></svg>
            : <g><rect x="140" y="112" width="80" height="44" rx="6" fill="#9A6B42" /><rect x="136" y="100" width="88" height="16" rx="8" fill={CREAM} /><circle cx="168" cy="98" r="5" fill="#A3233A" /><circle cx="190" cy="96" r="5" fill="#A3233A" /></g>}
        </motion.g>
      )}
      <rect x="112" y="150" width="136" height="64" rx="4" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      <rect x="174" y="150" width="12" height="64" fill={SAGE} opacity="0.85" />
      <text x="128" y="190" fontFamily="Georgia, serif" fontSize="14" fill={SAGE_D}>Tresor</text>
      <motion.g animate={open ? { rotate: -24, x: -36, y: -26 } : { rotate: 0, x: 0, y: 0 }} transition={{ duration: 0.7, ease: EASE }} style={{ transformOrigin: '112px 150px' }}>
        <rect x="106" y="134" width="148" height="18" rx="4" fill="#fff" stroke={LINE} strokeWidth="1.5" />
        <rect x="174" y="134" width="12" height="18" fill={SAGE} opacity="0.85" />
        {!open && <g><path d="M180 134 c-14 -16 -30 -4 -14 2z" fill={SAGE_D} /><path d="M180 134 c14 -16 30 -4 14 2z" fill={SAGE_D} /></g>}
      </motion.g>
      {open && [[118, 96], [246, 88], [232, 132], [128, 138], [180, 52]].map(([x, y], i) => (
        <motion.path key={i} d={`M${x} ${y} l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z`} fill={WARM} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0.55], scale: 1 }} transition={{ delay: 0.9 + i * 0.12, duration: 1.2 }} style={{ transformOrigin: `${x}px ${y + 6}px` }} />
      ))}
    </g>
  );
}

function Journey({ progress }: { progress: number }) {
  // Conceptual leg from the bakery to the customer. No map, no invented location.
  const p = (t: number) => { const x0 = 70, y0 = 170, cx = 180, cy = 96, x1 = 290, y1 = 170; return [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1]; };
  const [mx, my] = p(progress);
  return (
    <g>
      <path d="M70 170 Q180 96 290 170" fill="none" stroke={LINE} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <motion.path d="M70 170 Q180 96 290 170" fill="none" stroke={SAGE} strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: progress }} transition={{ duration: 1.2, ease: EASE }} />
      <circle cx="70" cy="170" r="7" fill={SAGE_D} /><text x="70" y="198" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fill={INK}>Tresor</text>
      <circle cx="290" cy="170" r="7" fill="#fff" stroke={INK} strokeWidth="2" /><text x="290" y="198" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="11" letterSpacing="2" fill={INK}>YOU</text>
      <motion.g animate={{ x: mx - 180, y: my - 120 }} transition={{ duration: 1.2, ease: EASE }}>
        <g className="ts-bob">
          <rect x="166" y="104" width="28" height="20" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
          <rect x="178" y="104" width="4" height="20" fill={SAGE} />
          <circle cx="172" cy="128" r="4" fill={INK} /><circle cx="188" cy="128" r="4" fill={INK} />
        </g>
      </motion.g>
    </g>
  );
}

function Closed({ failed = false }: { failed?: boolean }) {
  return (
    <g opacity="0.85">
      {failed
        ? <g><rect x="114" y="96" width="132" height="86" rx="10" fill="#fff" stroke={LINE} strokeWidth="1.5" /><rect x="114" y="114" width="132" height="14" fill={LINE} /><path d="M166 150 l28 20 m0 -20 l-28 20" stroke={SAGE_D} strokeWidth="3" strokeLinecap="round" /></g>
        : <g><rect x="112" y="130" width="136" height="70" rx="4" fill="#F1F3F2" stroke={LINE} strokeWidth="1.5" /><rect x="106" y="116" width="148" height="18" rx="4" fill="#F1F3F2" stroke={LINE} strokeWidth="1.5" /><line x1="120" y1="210" x2="240" y2="210" stroke={SAGE_L} strokeWidth="2" strokeLinecap="round" /></g>}
    </g>
  );
}

/** The scene for a status. Keyed by status by the caller, so changes cross-fade. */
export function StatusScene({ status, order, progress = 0 }: { status: TrackingStatus; order: Order | null; progress?: number }) {
  const scene = (() => {
    switch (status) {
      case 'NEW': return <Ticket />;
      case 'CONFIRMED': return <Stamp />;
      case 'PREPARING': return <Oven tint={cakeColor(order)} />;
      case 'READY': return <Box order={order} />;
      case 'OUT_FOR_DELIVERY': return <Journey progress={progress} />;
      case 'DELIVERED': return <Box open order={order} />;
      case 'CANCELLED': return <Closed />;
      case 'PAYMENT_FAILED': return <Closed failed />;
    }
  })();
  return (
    <motion.svg viewBox="0 0 360 260" className={`track-scene scene-${status.toLowerCase()}`} role="img" aria-hidden="true" {...enter}>
      {scene}
    </motion.svg>
  );
}
