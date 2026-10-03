'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MediaSlot } from '@/data/media';

// Only one decorative video plays at a time (CLAUDE.md §29).
let playing: HTMLVideoElement | null = null;

type LazyVideoProps = {
  slot: MediaSlot;
  /** Shown when the slot has no media yet, and behind the poster while loading. */
  fallback: ReactNode;
  className?: string;
  /** Hero video: attach sources immediately instead of on scroll. */
  eager?: boolean;
};

/**
 * Poster first; sources are attached only when the video nears the viewport.
 * Pauses when scrolled away. Under reduced motion it shows the poster (or the
 * fallback) and never autoplays.
 */
export function LazyVideo({ slot, fallback, className = '', eager = false }: LazyVideoProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [attached, setAttached] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const hasVideo = Boolean(slot.src || slot.webm);

  useEffect(() => {
    const video = ref.current;
    if (!video || !hasVideo || reduce) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setAttached(true);
        if (playing && playing !== video) playing.pause();
        playing = video;
        video.play().catch(() => {});
      } else {
        video.pause();
        if (playing === video) playing = null;
      }
    }, { rootMargin: '200px 0px', threshold: 0.15 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [hasVideo, reduce]);

  // Newly attached <source> elements are only read after load().
  useEffect(() => {
    const video = ref.current;
    if (!attached || !video || reduce) return;
    video.load();
    video.play().catch(() => {});
  }, [attached, reduce]);

  const decorative = !slot.alt;

  return (
    <div className={`media-frame ${className}`}>
      <div className="media-fallback" aria-hidden={hasVideo || decorative ? true : undefined}>{fallback}</div>
      {slot.poster && !loaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="media-poster" src={slot.poster} alt={decorative ? '' : slot.alt} />
      )}
      {hasVideo && !reduce && (
        <video
          ref={ref}
          className={`media-video ${loaded ? 'is-loaded' : ''}`}
          muted
          loop
          playsInline
          preload={eager ? 'auto' : 'none'}
          poster={slot.poster}
          onLoadedData={() => setLoaded(true)}
          aria-hidden={decorative ? true : undefined}
          aria-label={decorative ? undefined : slot.alt}
        >
          {attached && slot.webm && <source src={slot.webm} type="video/webm" />}
          {attached && slot.src && <source src={slot.src} type="video/mp4" />}
        </video>
      )}
    </div>
  );
}
