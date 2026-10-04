'use client';

import { useRef, type CSSProperties } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Parallax, SplitText, useReducedMotionSafe } from '@/components/cinematic';
import { team, type TeamTile } from '@/lib/story';
import { Reveal, StoryMedia } from './primitives';

/** One photograph placed in the spread: its own reveal, depth and (rarely) a 1–2° tilt. */
function Tile({ tile, delay = 0 }: { tile: TeamTile; delay?: number }) {
  const style = {
    '--col': tile.col, '--row': tile.row ?? 'auto', '--mt': tile.mt ?? '0', '--mr': tile.mr ?? '0', '--mcol': tile.mcol, '--z': tile.z ?? 1,
  } as CSSProperties;
  const frame = (
    <Reveal kind={tile.reveal} delay={delay} amount={0.2}>
      <figure className="team-figure" style={tile.rotate ? { transform: `rotate(${tile.rotate}deg)` } : undefined}>
        <div className="team-frame" style={{ aspectRatio: tile.ratio }}>
          <StoryMedia id={tile.asset} focus={tile.focus} sizes="(max-width: 760px) 90vw, 40vw" />
        </div>
        {tile.caption && <figcaption>{tile.caption}</figcaption>}
      </figure>
    </Reveal>
  );
  return <div className={`team-tile team-${tile.id}`} style={style}>{tile.depth ? <Parallax distance={tile.depth}>{frame}</Parallax> : frame}</div>;
}

/** The last portrait: larger, with a slow crop settling as it scrolls into place. */
function FinalPortrait({ tile }: { tile: TeamTile }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.16, 1]);
  return (
    <div ref={ref} className="team-final" style={{ '--col': tile.col, '--mcol': tile.mcol } as CSSProperties}>
      <Reveal kind="clip" amount={0.15}>
        <div className="team-frame team-final-frame" style={{ aspectRatio: tile.ratio }}>
          <motion.div className="team-final-crop" style={reduce ? undefined : { scale }}>
            <StoryMedia id={tile.asset} focus={tile.focus} sizes="(max-width: 760px) 92vw, 50vw" />
          </motion.div>
        </div>
      </Reveal>
    </div>
  );
}

/**
 * 10 · The people behind the cake. A photographic spread, assembled as you scroll:
 * headline → portrait → process → a living fragment → three words → portrait,
 * the team, a moment → 8+ years → the final portrait → closing line.
 */
export function TeamChapter() {
  return (
    <section className="story-team" aria-labelledby="team-title">
      <div className="team-spread team-opening">
        <div className="team-head">
          <div className="eyebrow">{team.eyebrow}</div>
          <h2 id="team-title" className="team-title">
            {team.headline.map((line, i) => <SplitText key={line} as="span" text={line} delay={i * 0.12} className={`team-title-line team-title-line-${i}`} />)}
          </h2>
          <Reveal kind="still" delay={0.5}><p className="team-support">{team.support}</p></Reveal>
        </div>
        {team.opening.map((t, i) => <Tile key={t.id} tile={t} delay={0.15 * i} />)}
      </div>

      <div className="team-interlude" aria-label={team.interlude.join(' ')}>
        {team.interlude.map((w, i) => <SplitText key={w} as="p" text={w} delay={i * 0.18} className={`team-word team-word-${i}`} />)}
      </div>

      <div className="team-spread team-middle">
        {team.middle.map((t, i) => <Tile key={t.id} tile={t} delay={0.12 * i} />)}
        <div className="team-years">
          {team.years.map((l, i) => <SplitText key={l} as="p" text={l} delay={i * 0.15} className={`team-years-line team-years-line-${i}`} />)}
        </div>
      </div>

      <div className="team-spread team-end">
        <FinalPortrait tile={team.final} />
      </div>

      <div className="team-closing">
        <SplitText as="p" text={team.closing} className="team-closing-line" />
        <Reveal kind="still" delay={0.4}><p className="team-signature">{team.signature}<span>•</span></p></Reveal>
      </div>
    </section>
  );
}
