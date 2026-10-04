'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SplitText } from '@/components/cinematic';
import { love, visibleReviews, type Review } from '@/lib/story';
import { Reveal, StoryMedia, useLiveWhileVisible, type RevealKind } from './primitives';

type Piece = { type: 'photo'; asset: string; moment: string } | { type: 'quote'; review: Review };

/** Photo, quote, photo, quote…: memories accumulating rather than a row of cards. */
function interleave(photos: typeof love.photos, reviews: Review[], maxPhotos: number, maxQuotes: number): Piece[] {
  const ps = photos.slice(0, maxPhotos);
  const qs = reviews.slice(0, maxQuotes);
  const out: Piece[] = [];
  for (let i = 0; i < Math.max(ps.length, qs.length); i += 1) {
    if (qs[i]) out.push({ type: 'quote', review: qs[i] });
    if (ps[i]) out.push({ type: 'photo', ...ps[i] });
  }
  return out;
}

const MOTIONS: RevealKind[] = ['still', 'clip', 'rise', 'scale', 'still', 'slide', 'rise', 'clip', 'still', 'scale'];

/**
 * 07 Customer love. The rhythm changes: dark, slower, candlelit. Placeholder reviews
 * are shown only in development and are labelled as such; production shows only
 * real reviews (none yet), so the section falls back to its photographs.
 */
export function CustomerLove({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const reviews = visibleReviews();
  const compact = variant === 'compact';
  const pieces = interleave(love.photos, reviews, compact ? 3 : 5, compact ? 3 : 5);
  const hasMock = reviews.some((r) => r.mock);
  const live = useLiveWhileVisible<HTMLElement>();
  return (
    <section ref={live} className={`story-love ${compact ? 'is-compact' : ''}`} aria-label={love.title}>
      <span className="love-grain" aria-hidden="true" />
      <div className="container love-head">
        <div className="eyebrow">{love.eyebrow}</div>
        <SplitText as="h2" text={love.title} className="love-title" />
        <Reveal kind="still" delay={0.35}><p className="love-sub">{love.sub}</p></Reveal>
      </div>
      <div className={`container love-wall ${reviews.length === 0 ? 'is-photos-only' : ''}`}>
        {pieces.map((piece, i) => (
          <Reveal key={piece.type === 'quote' ? piece.review.id : piece.asset} kind={MOTIONS[i % MOTIONS.length]} delay={0.08 * (i % 3)} className={`love-piece love-slot-${i} love-${piece.type}`} amount={0.35}>
            {piece.type === 'photo' ? (
              <figure>
                <div className="love-frame"><StoryMedia id={piece.asset} sizes="(max-width: 760px) 70vw, 28vw" /></div>
                <figcaption>{piece.moment}</figcaption>
              </figure>
            ) : (
              <blockquote>
                <p>{piece.review.quote}</p>
                <footer>— {piece.review.author} · {piece.review.moment}{piece.review.product ? ` · ${piece.review.product}` : ''}</footer>
              </blockquote>
            )}
          </Reveal>
        ))}
      </div>
      {hasMock && <p className="love-mock-note container">Development preview: sample words for layout. Replace with real customer reviews in lib/story.ts before launch.</p>}
      {compact && (
        <div className="container love-more"><Link href="/about" className="love-link">Read the Tresor story <ArrowRight size={15} /></Link></div>
      )}
    </section>
  );
}
