'use client';

// The cake preview: a layered 2D renderer driven only by the configuration.
// Views: 'front' (three-quarter, extruded) and 'top' (flat, for message and print).
// A future 3D renderer can read the same configuration.

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useMemo, useRef, type PointerEvent } from 'react';
import { find, messageLines, shapeOf, sizeOf } from '@/lib/cake/engine';
import { colors, fonts, printRules, sponges, fillings } from '@/lib/cake/config';
import type { CakeConfiguration, ColorOption, ToppingOption } from '@/lib/cake/types';
import { EASE } from '@/lib/motion';
import { extent, frontEdge, outline, printBox, ring, scalePts, SQUASH, toPath, type Pt } from './geometry';

export type PreviewView = 'front' | 'top';
type Props = {
  config: CakeConfiguration;
  view?: PreviewView;
  /** Show the safe print area and enable dragging the photo. */
  editing?: 'message' | 'print' | null;
  printUrl?: string | null;
  onPrintMove?: (x: number, y: number) => void;
  className?: string;
  title?: string;
};

const VB = 600;
const CX = 300;
const REF_W = 340; // geometry is drawn for a reference width, then scaled per size

const SIZE_SCALE: Record<number, number> = { 4: 0.72, 6: 0.84, 8: 0.94, 10: 1.02, 12: 1.1 };

const shadeOf = (c?: ColorOption) => c?.shade ?? '#D9CBB4';

/** Blend two hex colours (t = share of b). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function Topping({ t, x, y, s, i }: { t: ToppingOption; x: number; y: number; s: number; i: number }) {
  const r = 9 * s;
  const rot = (i * 47) % 360;
  switch (t.kind) {
    case 'berry':
      return <g><circle cx={x} cy={y} r={r} fill={t.color} /><circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill="#fff" opacity={0.45} /><path d={`M${x - r * 0.4},${y - r * 0.85} q${r * 0.4},${-r * 0.5} ${r * 0.8},0`} stroke="#5C7A3A" strokeWidth={1.6 * s} fill="none" /></g>;
    case 'curl':
      return <g transform={`rotate(${rot} ${x} ${y})`}><rect x={x - r * 1.3} y={y - r * 0.38} width={r * 2.6} height={r * 0.76} rx={r * 0.38} fill={t.color} /><path d={`M${x - r},${y} h${r * 2}`} stroke="#7B5543" strokeWidth={0.8 * s} /></g>;
    case 'nut':
      return <g>{[[-0.6, 0.1], [0.5, -0.2], [0.05, 0.5]].map(([dx, dy], k) => <ellipse key={k} cx={x + dx * r} cy={y + dy * r} rx={r * 0.42} ry={r * 0.3} fill={t.color} transform={`rotate(${rot + k * 40} ${x + dx * r} ${y + dy * r})`} />)}</g>;
    case 'macaron':
      return <g><ellipse cx={x} cy={y + r * 0.25} rx={r * 1.15} ry={r * 0.55} fill={t.color} /><rect x={x - r * 1.05} y={y - r * 0.08} width={r * 2.1} height={r * 0.3} fill="#FBF3EA" /><ellipse cx={x} cy={y - r * 0.25} rx={r * 1.15} ry={r * 0.55} fill={t.color} /><ellipse cx={x - r * 0.3} cy={y - r * 0.38} rx={r * 0.5} ry={r * 0.16} fill="#fff" opacity={0.35} /></g>;
    case 'flower':
      return <g>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={x + Math.cos(((a + rot) * Math.PI) / 180) * r * 0.62} cy={y + Math.sin(((a + rot) * Math.PI) / 180) * r * 0.62 * 0.8} rx={r * 0.55} ry={r * 0.38} fill={t.color} opacity={0.95} />)}<circle cx={x} cy={y} r={r * 0.3} fill="#E9C46A" /></g>;
    case 'gold':
      return <g transform={`rotate(${rot} ${x} ${y})`}><path d={`M${x - r},${y - r * 0.2} l${r * 0.9},${-r * 0.6} l${r * 1.1},${r * 0.5} l${-r * 0.5},${r * 0.7} z`} fill={t.color} /><path d={`M${x - r * 0.4},${y - r * 0.3} l${r * 0.7},${-r * 0.3}`} stroke="#F5E3A6" strokeWidth={1.2 * s} /></g>;
    case 'cookie':
      return <g><ellipse cx={x} cy={y} rx={r * 1.05} ry={r * 0.95} fill={t.color} /><ellipse cx={x} cy={y} rx={r * 0.8} ry={r * 0.72} fill="none" stroke="#B5864A" strokeWidth={0.8 * s} />{[[-0.3, -0.2], [0.25, 0.1], [-0.05, 0.35]].map(([dx, dy], k) => <circle key={k} cx={x + dx * r} cy={y + dy * r} r={r * 0.09} fill="#8A5E32" />)}</g>;
    default:
      return <g transform={`rotate(${rot} ${x} ${y})`}><rect x={x - r * 0.6} y={y - r * 0.6} width={r * 1.2} height={r * 1.2} rx={r * 0.2} fill={t.color} /><rect x={x - r * 0.45} y={y - r * 0.5} width={r * 0.5} height={r * 0.25} rx={r * 0.1} fill="#fff" opacity={0.35} /></g>;
  }
}

export function CakePreview({ config, view = 'front', editing = null, printUrl = null, onPrintMove, className = '', title }: Props) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const shape = shapeOf(config);
  const size = sizeOf(config);
  const kind = shape?.kind ?? 'round';
  const color = colors.find((c) => c.id === config.color) ?? colors[0];
  const frosting = find('frosting', config.frosting);
  const finish = find('finish', config.finish)?.kind ?? 'smooth';
  const sponge = sponges.find((s) => s.id === config.sponge) ?? sponges[0];
  const filling = fillings.find((f) => f.id === config.filling) ?? fillings[0];
  const font = fonts.find((f) => f.id === config.message.font) ?? fonts[0];
  const layers = size?.layers ?? 3;
  const scale = SIZE_SCALE[size?.inches ?? 6] ?? 0.9;
  const pts = useMemo(() => outline(kind), [kind]);
  const ext = extent(kind);
  const W = REF_W;
  const H = 60 + layers * 34; // cake height in px at reference size
  const transition = reduce ? { duration: 0 } : { duration: 0.6, ease: EASE };
  const semi = finish === 'semi-naked';
  const sideBase = semi ? sponge.color : mix(color.hex, shadeOf(color), 0.28);

  // Toppings: each portion becomes one piece, spread round a ring and sorted back-to-front.
  const pieces = useMemo(() => {
    const list: { t: ToppingOption; key: string }[] = [];
    for (const sel of config.toppings) {
      const t = find('toppings', sel.id) as ToppingOption | undefined;
      if (t) for (let i = 0; i < sel.qty; i += 1) list.push({ t, key: `${t.id}-${i}` });
    }
    const ringPts = ring(kind, list.length, list.length > 10 ? 0.7 : 0.74, 0.5);
    return list.map((p, i) => ({ ...p, at: ringPts[i] }));
  }, [config.toppings, kind]);

  const candleCount = config.candles.id === 'thin' ? 6 : 0;

  // ---------- Projections ----------
  const isTop = view === 'top';
  const topY = isTop ? 300 : 300 - H / 2 + 30;
  const topScale = isTop ? 1.25 : 1;
  const proj = ([x, y]: Pt, lift = 0): Pt => isTop
    ? [CX + x * W * topScale, 300 + y * W * topScale]
    : [CX + x * W, topY + y * W * SQUASH - lift];
  const topPath = (k = 1) => `M${scalePts(pts, k).map((p) => proj(p).map((n) => n.toFixed(1)).join(',')).join('L')}Z`;
  const sideCopies = isTop ? [] : Array.from({ length: Math.ceil(H / 5) + 1 }, (_, i) => Math.min(H, i * 5));

  const box = printBox(kind, printRules.printableInset);
  const boxTL = proj([box.x, box.y]);
  const boxBR = proj([box.x + box.w, box.y + box.h]);
  const printTransform = isTop ? undefined : `translate(0 ${topY}) scale(1 ${SQUASH}) translate(0 ${-topY})`;
  const pbx = isTop ? boxTL[0] : CX + box.x * W;
  const pby = isTop ? boxTL[1] : topY + box.y * W;
  const pbw = isTop ? boxBR[0] - boxTL[0] : box.w * W;
  const pbh = isTop ? boxBR[1] - boxTL[1] : box.h * W;

  const lines = messageLines(config.message.text);
  const fontPx = config.message.size * pbw;
  const msgX = config.message.align === 'left' ? pbx + pbw * 0.1 : config.message.align === 'right' ? pbx + pbw * 0.9 : pbx + pbw / 2;
  const msgY = pby + config.message.y * pbh;
  const anchor = config.message.align === 'left' ? 'start' : config.message.align === 'right' ? 'end' : 'middle';

  const front = frontEdge(scalePts(pts, 1));
  const dripPath = useMemo(() => {
    if (!config.decorations.includes('drip') || isTop) return null;
    const pp = front.map((p) => proj(p));
    let d = `M${pp[0][0]},${pp[0][1]}`;
    pp.forEach(([x, y], i) => {
      const len = 14 + ((i * 37) % 23) * (i % 3 === 0 ? 1.6 : 0.7);
      d += i % 2 === 0 ? ` L${x},${y + len} a4,4 0 0 0 8,0 L${x + 8},${y}` : ` L${x},${y}`;
    });
    return `${d} L${pp[pp.length - 1][0]},${pp[pp.length - 1][1]} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.decorations, kind, isTop, H]);

  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const toLocal = (e: PointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * VB, ((e.clientY - r.top) / r.height) * VB] as Pt;
  };
  const onDown = (e: PointerEvent) => {
    if (editing !== 'print' || !onPrintMove || !isTop) return;
    const [x, y] = toLocal(e);
    drag.current = { dx: x - (pbx + config.print.x * pbw), dy: y - (pby + config.print.y * pbh) };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current || !onPrintMove) return;
    const [x, y] = toLocal(e);
    onPrintMove(Math.min(1, Math.max(0, (x - drag.current.dx - pbx) / pbw)), Math.min(1, Math.max(0, (y - drag.current.dy - pby) / pbh)));
  };
  const onUp = () => { drag.current = null; };

  const imgW = config.print.scale * pbw;
  const imgH = config.print.sourceWidth ? imgW * (config.print.sourceHeight / config.print.sourceWidth) : imgW;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} className={`cake-preview ${className}`} role="img" aria-label={title ?? `Preview: ${size?.name} ${shape?.name.toLowerCase()} cake, ${color.name.toLowerCase()} ${frosting?.name.toLowerCase()}`}
      onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      <defs>
        <linearGradient id={`side-${uid}`} x1="0" x2="1">
          <motion.stop offset="0" animate={{ stopColor: semi ? sponge.color : shadeOf(color) }} transition={transition} />
          <motion.stop offset="0.38" animate={{ stopColor: sideBase }} transition={transition} />
          <motion.stop offset="0.62" animate={{ stopColor: sideBase }} transition={transition} />
          <motion.stop offset="1" animate={{ stopColor: semi ? sponge.color : shadeOf(color) }} transition={transition} />
        </linearGradient>
        <radialGradient id={`top-${uid}`} cx="0.42" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35 + (frosting?.sheen ?? 0.3) * 0.3} />
          <stop offset="0.6" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`plate-${uid}`} cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E3E8E6" /></radialGradient>
        <pattern id={`ruffle-${uid}`} width="16" height="22" patternUnits="userSpaceOnUse"><path d="M0,22 C4,10 12,10 16,22" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="2" /><path d="M0,11 C4,0 12,0 16,11" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" /></pattern>
        <pattern id={`texture-${uid}`} width="34" height="12" patternUnits="userSpaceOnUse"><path d="M2,8 q8,-6 16,0 t14,-2" fill="none" stroke="#000" strokeOpacity="0.1" strokeWidth="1.6" /></pattern>
        <clipPath id={`sideclip-${uid}`}>{sideCopies.map((lift) => <path key={lift} d={topPath()} transform={`translate(0 ${lift})`} />)}</clipPath>
        <clipPath id={`topclip-${uid}`}><path d={topPath()} /></clipPath>
        <clipPath id={`printclip-${uid}`}>{kind === 'round' ? <ellipse cx={pbx + pbw / 2} cy={pby + pbh / 2} rx={pbw / 2} ry={pbh / 2} /> : kind === 'heart' ? <path d={`M${scalePts(pts, 1 - 2 * printRules.printableInset).map(([x, y]) => [pbx + (x + 0.5) * pbw, pby + (y + 0.5) * pbh].map((n) => n.toFixed(1)).join(',')).join('L')}Z`} /> : <rect x={pbx} y={pby} width={pbw} height={pbh} rx={6} />}</clipPath>
      </defs>

      {/* Plate */}
      {!isTop && <ellipse cx={CX} cy={topY + H + 22} rx={W * ext.w * 0.66 * scale + 40} ry={(W * ext.h * SQUASH * 0.66 * scale + 16)} fill={`url(#plate-${uid})`} stroke="#D3DAD8" />}
      {!isTop && <ellipse cx={CX} cy={topY + H + 32} rx={W * ext.w * 0.6 * scale + 36} ry={14} fill="#1F2A28" opacity={0.08} />}

      <motion.g animate={{ scale }} transition={transition} style={{ transformOrigin: `${CX}px ${isTop ? 300 : topY + H}px` }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.g key={`${kind}-${view}-${layers}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={transition} style={{ transformOrigin: `${CX}px ${topY}px` }}>
            {/* Side: the outline extruded downwards */}
            {!isTop && (
              <g clipPath={`url(#sideclip-${uid})`}>
                <rect x={CX - W} y={topY - W} width={W * 2} height={H + W * 1.4} fill={`url(#side-${uid})`} />
                {semi && Array.from({ length: layers - 1 }, (_, i) => (
                  <motion.rect key={i} x={CX - W} y={topY + W * 0.5 * SQUASH + ((i + 1) * H) / layers - 5} width={W * 2} height={9} animate={{ fill: filling.color }} transition={transition} opacity={0.9} />
                ))}
                {semi && <rect x={CX - W} y={topY - W} width={W * 2} height={H + W * 1.4} fill={color.hex} opacity={0.45} />}
                {finish === 'ruffled' && <rect x={CX - W} y={topY - W} width={W * 2} height={H + W * 1.4} fill={`url(#ruffle-${uid})`} />}
                {finish === 'textured' && <rect x={CX - W} y={topY - W} width={W * 2} height={H + W * 1.4} fill={`url(#texture-${uid})`} />}
                {(frosting?.sheen ?? 0) > 0.5 && <rect x={CX - W * 0.32} y={topY - W} width={W * 0.12} height={H + W * 1.4} fill="#fff" opacity={0.18} />}
                {config.decorations.includes('ribbon') && <rect x={CX - W} y={topY + W * 0.5 * SQUASH + H - 34} width={W * 2} height={18} fill="#E9DFD2" opacity={0.95} />}
                {config.decorations.includes('gold-leaf') && [[-0.3, 0.45], [0.18, 0.6], [0.32, 0.3], [-0.05, 0.75]].map(([dx, dy], i) => <path key={i} d={`M${CX + dx * W},${topY + W * 0.3 * SQUASH + dy * H} l14,-8 l12,10 l-10,9 z`} fill="#D4AF5A" opacity={0.9} />)}
              </g>
            )}

            {/* Top */}
            <motion.path d={topPath()} animate={{ fill: color.hex }} transition={transition} stroke={shadeOf(color)} strokeOpacity={0.35} />
            <path d={topPath()} fill={`url(#top-${uid})`} />
            {isTop && finish === 'ruffled' && <path d={topPath(0.97)} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={6} strokeDasharray="3 9" />}
            {!isTop && (
              <g pointerEvents="none">
                <path d={`M${front.map((p) => proj(p).map((n) => n.toFixed(1)).join(',')).join('L')}`} fill="none" stroke="#000" strokeOpacity={0.07} strokeWidth={6} transform="translate(0 4)" />
                <path d={`M${front.map((p) => proj(p).map((n) => n.toFixed(1)).join(',')).join('L')}`} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.6} />
              </g>
            )}

            {/* Edible print and message, on the printable area */}
            <g transform={printTransform} clipPath={`url(#printclip-${uid})`}>
              <AnimatePresence>
                {config.print.enabled && printUrl && (
                  <motion.image key="print" href={printUrl} x={pbx + config.print.x * pbw - imgW / 2} y={pby + config.print.y * pbh - imgH / 2} width={imgW} height={imgH}
                    preserveAspectRatio="none" transform={`rotate(${config.print.rotation} ${pbx + config.print.x * pbw} ${pby + config.print.y * pbh})`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}
                    style={{ cursor: editing === 'print' && isTop ? 'grab' : undefined }} onPointerDown={onDown} />
                )}
                {config.print.enabled && !printUrl && (
                  <motion.rect key="print-ph" x={pbx} y={pby} width={pbw} height={pbh} fill="#000" opacity={0.04} initial={{ opacity: 0 }} animate={{ opacity: 0.04 }} exit={{ opacity: 0 }} />
                )}
              </AnimatePresence>
            </g>
            <g transform={printTransform}>
              <AnimatePresence>
                {lines.length > 0 && (
                  <motion.text key={`${config.message.font}-${lines.join('|')}`} x={msgX} y={msgY - ((lines.length - 1) * fontPx * font.lineHeight) / 2} textAnchor={anchor} dominantBaseline="middle"
                    fontFamily={font.family} fontSize={fontPx} fill={config.message.color} transform={`rotate(${config.message.rotation} ${msgX} ${msgY})`}
                    initial={reduce ? false : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}>
                    {lines.map((l, i) => <tspan key={i} x={msgX} dy={i === 0 ? 0 : fontPx * font.lineHeight}>{l}</tspan>)}
                  </motion.text>
                )}
              </AnimatePresence>
            </g>
            {editing && isTop && (
              <g transform={printTransform} pointerEvents="none">
                {kind === 'round' ? <ellipse cx={pbx + pbw / 2} cy={pby + pbh / 2} rx={pbw / 2} ry={pbh / 2} className="safe-area" /> : <rect x={pbx} y={pby} width={pbw} height={pbh} rx={6} className="safe-area" />}
              </g>
            )}

            {/* Border decorations */}
            {config.decorations.includes('piped-border') && scalePts(pts, 0.95).filter((_, i) => i % 2 === 0).map((p, i) => { const [x, y] = proj(p); return <ellipse key={i} cx={x} cy={y} rx={7} ry={isTop ? 7 : 5} fill={color.hex} stroke={shadeOf(color)} strokeOpacity={0.5} />; })}
            {config.decorations.includes('pearls') && scalePts(pts, 0.9).filter((_, i) => i % 3 === 0).map((p, i) => { const [x, y] = proj(p); return <circle key={i} cx={x} cy={y} r={3.4} fill="#FBF7EF" stroke="#D8D2C4" strokeWidth={0.6} />; })}
            {dripPath && <motion.path d={dripPath} fill="#3B2218" initial={{ opacity: 0, scaleY: 0.4 }} animate={{ opacity: 1, scaleY: 1 }} transition={transition} style={{ transformOrigin: `${CX}px ${topY}px` }} />}
            {config.decorations.includes('shards') && [[-0.12, -0.18], [0.02, -0.24], [0.14, -0.16]].map(([dx, dy], i) => { const [x, y] = proj([dx, dy]); return <path key={i} d={`M${x - 10},${y} L${x - 2},${y - (isTop ? 16 : 46)} L${x + 12},${y} Z`} fill="#3A2318" stroke="#5E3B2A" />; })}

            {/* Toppings settle onto the cake, back to front */}
            <AnimatePresence initial={false}>
              {[...pieces].sort((a, b) => a.at[1] - b.at[1]).map(({ t, key, at }, i) => {
                const [x, y] = proj(at);
                return (
                  <motion.g key={key} initial={reduce ? false : { opacity: 0, y: -36 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: reduce ? 0 : 0.55, ease: EASE, delay: reduce ? 0 : (i % 6) * 0.03 }}>
                    <Topping t={t} x={x} y={y} s={isTop ? 1.25 : 1} i={i} />
                  </motion.g>
                );
              })}
            </AnimatePresence>

            {/* Topper */}
            <AnimatePresence>
              {config.topper.id !== 'none' && !isTop && (() => {
                const [x, y] = proj([0, -0.16]);
                const label = config.topper.id === 'birthday' ? 'Happy Birthday' : config.topper.text || (config.topper.id === 'number' ? '1' : 'Name');
                const big = config.topper.id === 'number';
                return (
                  <motion.g key="topper" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={transition}>
                    <line x1={x - 22} y1={y} x2={x - 22} y2={y - 54} stroke="#B8913F" strokeWidth={2} />
                    <line x1={x + 22} y1={y} x2={x + 22} y2={y - 54} stroke="#B8913F" strokeWidth={2} />
                    <text x={x} y={y - 62} textAnchor="middle" fontFamily={big ? 'Georgia, serif' : fonts[1].family} fontSize={big ? 58 : 30} fill="#C9A24E" stroke="#8F6C26" strokeWidth={0.6}>{label}</text>
                  </motion.g>
                );
              })()}
            </AnimatePresence>

            {/* Candles */}
            <AnimatePresence>
              {!isTop && candleCount > 0 && ring(kind, candleCount, 0.42, 0.25).sort((a, b) => a[1] - b[1]).map((p, i) => {
                const [x, y] = proj(p);
                return (
                  <motion.g key={`c${i}`} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...transition, delay: reduce ? 0 : i * 0.05 }}>
                    <rect x={x - 2.5} y={y - 46} width={5} height={46} rx={2} fill="#F5EFE6" stroke="#D9CFC0" strokeWidth={0.6} />
                    <path d={`M${x},${y - 60} q5,8 0,12 q-5,-4 0,-12`} fill="#F2B544" className="cake-flame" />
                  </motion.g>
                );
              })}
              {!isTop && config.candles.id === 'number' && config.candles.text && (() => {
                const [x, y] = proj([0.12, 0.04]);
                return <motion.g key="numcandle" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transition}><text x={x} y={y} textAnchor="middle" fontFamily="Georgia, serif" fontSize={54} fill="#F4D9A8" stroke="#C99A55">{config.candles.text}</text><path d={`M${x},${y - 56} q5,8 0,12 q-5,-4 0,-12`} fill="#F2B544" className="cake-flame" /></motion.g>;
              })()}
              {!isTop && config.candles.id === 'sparkler' && (() => {
                const [x, y] = proj([0.08, -0.05]);
                return <motion.g key="sparkler" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}><line x1={x} y1={y} x2={x} y2={y - 70} stroke="#9AA0A0" strokeWidth={2} />{Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return <line key={k} className="cake-spark" x1={x} y1={y - 78} x2={x + Math.cos(a) * 16} y2={y - 78 + Math.sin(a) * 16} stroke="#F6D47A" strokeWidth={1.4} style={{ animationDelay: `${k * 0.07}s` }} />; })}</motion.g>;
              })()}
            </AnimatePresence>
          </motion.g>
        </AnimatePresence>
      </motion.g>
    </svg>
  );
}

/** A slice showing what's inside: sponge layers, filling, frosting. */
export function InsidePreview({ config }: { config: CakeConfiguration }) {
  const sponge = sponges.find((s) => s.id === config.sponge) ?? sponges[0];
  const filling = fillings.find((f) => f.id === config.filling) ?? fillings[0];
  const color = colors.find((c) => c.id === config.color) ?? colors[0];
  const layers = sizeOf(config)?.layers ?? 3;
  const semi = config.finish === 'semi-naked';
  const h = 90;
  const band = h / (layers * 2 - 1);
  return (
    <svg viewBox="0 0 160 120" className="inside-preview" role="img" aria-label={`Inside: ${layers} layers of ${sponge.name.toLowerCase()} with ${filling.name.toLowerCase()}`}>
      <path d="M20,22 L140,10 L140,100 L20,112 Z" fill={color.hex} />
      {Array.from({ length: layers * 2 - 1 }, (_, i) => (
        <motion.path key={i} d={`M26,${24 + i * band} L134,${14 + i * band} L134,${14 + (i + 1) * band} L26,${24 + (i + 1) * band} Z`} animate={{ fill: i % 2 === 0 ? sponge.color : filling.color }} transition={{ duration: 0.5 }} />
      ))}
      {!semi && <path d="M20,22 L140,10 L140,16 L20,28 Z" fill={color.hex} />}
      <path d="M140,10 L154,14 L154,104 L140,100 Z" fill={color.shade} opacity={semi ? 0.5 : 1} />
    </svg>
  );
}
