'use client';

import { motion, useMotionTemplate, useMotionValue, useMotionValueEvent, useScroll, useTransform, AnimatePresence, type MotionValue } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ScrollScene, SplitText, Parallax, useReducedMotionSafe } from '@/components/cinematic';
import { craft, opening, people, today, years } from '@/lib/story';
import { storyAsset } from '@/lib/story-media';
import { EASE, T } from '@/lib/motion';
import { FilmLoop, Reveal, StoryMedia } from './primitives';

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

// ---------- 01 Opening: the film starts in a narrow frame, then fills the screen ----------

export function StoryOpening() {
  const reduce = useReducedMotionSafe();
  if (reduce) return <section className="story-opening is-static"><OpeningFrame progress={null} /></section>;
  return <ScrollScene height="230vh" className="story-opening">{(p) => <OpeningFrame progress={p} />}</ScrollScene>;
}

function OpeningFrame({ progress }: { progress: MotionValue<number> | null }) {
  const mobile = useIsMobile();
  const zero = useMotionValue(0);
  const p = progress ?? zero;
  const open = useTransform(p, [0, 0.6], [0, 1]);
  const sideStart = mobile ? 12 : 36;
  const topStart = mobile ? 14 : 9;
  // Desktop stops at a portrait-cinema frame: the source is 720px wide, and full-bleed
  // on a wide screen would blow it up past sharpness. Phones are portrait, so they go full.
  const sideEnd = mobile ? 0 : 27;
  const side = useTransform(open, [0, 1], [sideStart, sideEnd]);
  const top = useTransform(open, [0, 1], [topStart, mobile ? 0 : 4]);
  const bottom = useTransform(open, [0, 1], [mobile ? 24 : 9, mobile ? 0 : 4]);
  const round = useTransform(open, [0, 1], [6, mobile ? 0 : 3]);
  const clip = useMotionTemplate`inset(${top}% ${side}% ${bottom}% ${side}% round ${round}px)`;
  const filmScale = useTransform(p, [0, 1], [1.12, 1]);
  const wordOpacity = useTransform(p, [0, 0.45], [1, 0]);
  const wordScale = useTransform(p, [0, 0.6], [1, 1.18]);
  const linesOpacity = useTransform(p, [0, 0.3], [1, 0]);
  const lateOpacity = useTransform(p, [0.62, 0.78, 0.95], [0, 1, 1]);
  const dim = useTransform(p, [0.5, 0.8], [0.15, 0.5]);
  const still = progress === null;

  return (
    <div className="opening-stage">
      <motion.div className="opening-word opening-word-back" aria-hidden="true" style={still ? undefined : { opacity: wordOpacity, scale: wordScale }}>{opening.wordmark}</motion.div>
      <motion.div className="opening-film" style={still ? { clipPath: `inset(${topStart}% ${sideStart}% ${mobile ? 24 : 9}% ${sideStart}% round 6px)` } : { clipPath: clip }}>
        <motion.div className="opening-film-inner" style={still ? undefined : { scale: filmScale }}>
          <FilmLoop id={opening.film} eager className="opening-video" />
        </motion.div>
        <motion.div className="opening-dim" style={still ? { opacity: 0.15 } : { opacity: dim }} />
      </motion.div>
      <motion.div className="opening-word opening-word-front" aria-hidden="true" style={still ? undefined : { opacity: wordOpacity, scale: wordScale }}>{opening.wordmark}</motion.div>
      <h1 className="sr-only">Our story: Tresor, {opening.years}</h1>
      <motion.div className="opening-lines" style={still ? undefined : { opacity: linesOpacity }}>
        <p className="opening-statement">{opening.lines.map((l, i) => <SplitText key={l} as="span" text={l} trigger="mount" delay={0.5 + i * 0.25} className="opening-line" />)}</p>
        <motion.p className="opening-years" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...T.editorial, delay: 1.2 }}>{opening.years}</motion.p>
      </motion.div>
      {!still && (
        <motion.p className="opening-late" style={{ opacity: lateOpacity }}>This is Tresor.</motion.p>
      )}
      {!still && <motion.span className="opening-cue" style={{ opacity: linesOpacity }} aria-hidden="true">Scroll</motion.span>}
    </div>
  );
}

// ---------- 02 8+ years: the numeral as the object, photography inside it ----------

export function StoryYears() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['20%', '80%']);
  const bgPos = useMotionTemplate`50% ${bgY}`;
  const mask = storyAsset(years.maskImage);
  const fill = `url("${mask.src}"), linear-gradient(160deg, ${mask.tone[0]}, ${mask.tone[1]})`;
  return (
    <section ref={ref} className="story-years" aria-labelledby="years-title">
      <div className="container years-grid">
        <div className="years-numeral-wrap">
          <motion.div className="years-numeral" aria-hidden="true" style={{ backgroundImage: fill, backgroundPosition: reduce ? '50% 50%' : bgPos }}
            initial={reduce ? false : { opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 1.4, ease: EASE }}>
            {years.numeral}
          </motion.div>
          {years.orbit.map((o, i) => (
            <div key={o.asset} className={`years-orbit years-orbit-${i}`}>
              <Parallax distance={i === 0 ? 120 : -90}>
                <Reveal kind={i === 0 ? 'clip' : 'scale'} delay={0.3 + i * 0.2}>
                  <figure style={{ transform: `rotate(${i === 0 ? -2 : 2.5}deg)` }}>
                    <StoryMedia id={o.asset} className="years-orbit-img" sizes="18vw" />
                    <figcaption>{o.caption}</figcaption>
                  </figure>
                </Reveal>
              </Parallax>
            </div>
          ))}
        </div>
        <div className="years-copy">
          <h2 id="years-title" className="years-label"><span className="sr-only">{years.numeral} </span>{years.label.map((l) => <span key={l}>{l}</span>)}</h2>
          <Reveal kind="still" delay={0.2}><p className="years-body">{years.body}</p></Reveal>
          <span className="years-meta" aria-hidden="true">Tresor · since the first early morning</span>
        </div>
      </div>
    </section>
  );
}

// ---------- 03 The craft: a visual essay, one line and one film per step ----------

export function StoryCraft() {
  const reduce = useReducedMotionSafe();
  if (reduce) {
    return (
      <section className="story-craft is-static" aria-labelledby="craft-title">
        <div className="container">
          <div className="eyebrow" id="craft-title">{craft.eyebrow}</div>
          <ol className="craft-static">
            {craft.steps.map((s) => <li key={s.id}><StoryMedia id={s.media} className="craft-static-media" /><span>{s.label}</span><p>{s.line}</p></li>)}
          </ol>
        </div>
      </section>
    );
  }
  return <ScrollScene height={`${craft.steps.length * 95}vh`} className="story-craft">{(p) => <CraftScene progress={p} />}</ScrollScene>;
}

function CraftLayer({ progress, index, count, id }: { progress: MotionValue<number>; index: number; count: number; id: string }) {
  const at = index / count;
  const reveal = useTransform(progress, [Math.max(0, at - 0.07), at + 0.03], [100, 0]);
  const clip = useMotionTemplate`inset(${reveal}% 0% 0% 0%)`;
  const scale = useTransform(progress, [at - 0.07, at + 0.2], [1.12, 1]);
  return (
    <motion.div className="craft-layer" style={index === 0 ? undefined : { clipPath: clip }}>
      <motion.div className="craft-layer-inner" style={{ scale }}><StoryMedia id={id} className="craft-media" sizes="(max-width: 760px) 90vw, 40vw" /></motion.div>
    </motion.div>
  );
}

function CraftScene({ progress }: { progress: MotionValue<number> }) {
  const n = craft.steps.length;
  const [active, setActive] = useState(0);
  useMotionValueEvent(progress, 'change', (v) => setActive(Math.min(n - 1, Math.max(0, Math.floor(v * n + 0.04)))));
  const bar = useTransform(progress, [0, 1], ['0%', '100%']);
  const step = craft.steps[active];
  return (
    <div className="craft-stage container" aria-labelledby="craft-eyebrow">
      <div className="craft-copy">
        <div className="eyebrow" id="craft-eyebrow">{craft.eyebrow}</div>
        <ol className="craft-steps" aria-label="From ingredient to table">
          {craft.steps.map((s, i) => <li key={s.id} className={i === active ? 'is-active' : i < active ? 'is-done' : ''}><span>{String(i + 1).padStart(2, '0')}</span>{s.label}</li>)}
        </ol>
        <div className="craft-track"><motion.span style={{ width: bar }} /></div>
        <div className="craft-line-wrap">
          <AnimatePresence mode="wait">
            <motion.h2 key={step.id} className="craft-line" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.55, ease: EASE }}>{step.line}</motion.h2>
          </AnimatePresence>
        </div>
        {/* All lines stay in the document for readers and search engines. */}
        <ul className="sr-only">{craft.steps.map((s) => <li key={s.id}>{s.label}: {s.line}</li>)}</ul>
      </div>
      <div className="craft-frame">
        {craft.steps.map((s, i) => <CraftLayer key={s.id} progress={progress} index={i} count={n} id={s.media} />)}
        <span className="craft-frame-label" aria-hidden="true">{String(active + 1).padStart(2, '0')} / {String(n).padStart(2, '0')} · {step.label}</span>
      </div>
    </div>
  );
}

// ---------- 04 The people: a quiet interlude ----------

export function StoryPeople() {
  return (
    <section className="story-people" aria-labelledby="people-title">
      <div className="container people-grid">
        <div className="people-text">
          <div className="eyebrow">{people.eyebrow}</div>
          <SplitText as="h2" text={people.title} className="people-title" />
          <Reveal kind="still" delay={0.3}><p className="people-body">{people.body}</p></Reveal>
        </div>
        <div className="people-media">
          <Parallax distance={-70}>
            <Reveal kind="clip"><StoryMedia id={people.media} className="people-img" sizes="(max-width: 760px) 70vw, 26vw" /></Reveal>
          </Parallax>
          <span className="people-caption" aria-hidden="true">A wish, just before</span>
        </div>
      </div>
    </section>
  );
}

// ---------- 06 The bakery today: one wide living frame ----------

export function StoryToday() {
  return (
    <section className="story-today" aria-labelledby="today-title">
      <div className="container today-grid">
        <div className="today-text">
          <div className="eyebrow">{today.eyebrow}</div>
          <SplitText as="h2" text={today.title} className="today-title" />
          <Reveal kind="still" delay={0.25}><p className="today-body">{today.body}</p></Reveal>
        </div>
        <Reveal kind="clip" className="today-frame-wrap">
          <FilmLoop id={today.film} className="today-frame" />
        </Reveal>
      </div>
    </section>
  );
}
