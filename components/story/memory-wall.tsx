'use client';

import { SplitText } from '@/components/cinematic';
import { memoryWall } from '@/lib/story';
import { CollageItem, Reveal, StoryMedia } from './primitives';

/**
 * 05 The memory wall: an art-directed archive. Desktop places each piece by hand
 * (positions in lib/story.ts); mobile re-sequences them into a narrow, offset column.
 */
export function MemoryWall() {
  return (
    <section className="story-wall" aria-labelledby="wall-title">
      <div className="container wall-head">
        <div className="eyebrow">{memoryWall.eyebrow}</div>
        <SplitText as="h2" text={memoryWall.title} className="wall-title" />
        <Reveal kind="still" delay={0.3}><p className="wall-meta">{memoryWall.meta}</p></Reveal>
      </div>
      <div className="wall-canvas">
        {memoryWall.items.map((item, i) => {
          const pos = { left: `${item.x}%`, top: `${item.y}%` };
          if (item.kind === 'text') {
            return (
              <CollageItem key={item.id} className={`wall-text wall-text-${item.size} ${item.vertical ? 'is-vertical' : ''} wall-seq-${i}`} style={pos} depth={item.depth} kind="still" delay={0.1}>
                <span aria-hidden={item.size === 'meta'}>{item.text}</span>
              </CollageItem>
            );
          }
          return (
            <CollageItem key={item.id} className={`wall-media wall-seq-${i}`} style={{ ...pos, width: `${item.w}%` }} rotate={item.rotate} depth={item.depth} kind={item.motion} delay={(i % 3) * 0.12}>
              <figure>
                <div className="wall-frame" style={{ aspectRatio: item.ratio }}><StoryMedia id={item.asset} focus={item.focus} sizes={`(max-width: 760px) 80vw, ${item.w}vw`} /></div>
                {item.caption && <figcaption>{item.caption}</figcaption>}
              </figure>
            </CollageItem>
          );
        })}
      </div>
    </section>
  );
}
