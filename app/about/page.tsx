import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtDrawing } from '@/components/media/product-art';
import { LazyVideo } from '@/components/media/lazy-video';
import { ImageReveal } from '@/components/motion/image-reveal';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { media } from '@/data/media';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: 'The house',
  description: 'Tresor is a café in Whitefield, Bengaluru, built around coffee, pastry and conversation.',
  alternates: { canonical: '/about' },
};

const DETAILS = [
  { word: 'Coffee', line: 'Pulled with patience. Small cups, full attention.', art: 'cup' as const, tone: 'tone-stone' },
  { word: 'Pastry', line: 'Laminated, shaped and baked here, never shipped in.', art: 'croissant' as const, tone: 'tone-warm' },
  { word: 'Conversation', line: 'Tables sized for two, and room to stay a while.', art: 'teacup' as const, tone: 'tone-sage' },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero wrap">
        <Reveal><div className="eyebrow">08 / The house</div></Reveal>
        <TextReveal as="h1" immediate delay={0.2} lines={['A place to stay', 'a little longer.']} className="about-title display" />
      </section>

      <ImageReveal className="about-film" immediate delay={0.35}>
        <LazyVideo
          slot={media.coffeePour}
          fallback={
            <div className="about-film-still tone-cream">
              <span className="window-light" />
              <div className="about-film-art"><ArtDrawing art="cup" /></div>
            </div>
          }
        />
      </ImageReveal>

      <section className="about-statement wrap">
        <Reveal className="statement-meta"><span className="eyebrow">{site.neighbourhood} · {site.city}</span></Reveal>
        <TextReveal as="p" lines={['We wanted a café that makes', 'time feel a little slower:', 'considered, without excess.']} className="statement display" gap={0.1} />
      </section>

      <section className="about-details wrap" aria-labelledby="details-title">
        <Reveal><div className="eyebrow" id="details-title">The details</div></Reveal>
        <div className="details-grid">
          {DETAILS.map((detail, i) => (
            <Reveal key={detail.word} delay={i * 0.08} className="detail-item">
              <Parallax distance={40 + i * 20} className={`detail-art ${detail.tone}`}>
                <ArtDrawing art={detail.art} />
              </Parallax>
              <h2 className="display">{detail.word}</h2>
              <p>{detail.line}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="about-close wrap">
        <TextReveal as="h2" lines={['Come in.', 'Stay for the second cup.']} className="section-title display" />
        <Reveal delay={0.15} className="about-close-actions">
          <Link href="/contact" className="btn btn-primary">Visit us</Link>
          <Link href="/menu" className="btn btn-secondary">See the menu</Link>
        </Reveal>
      </section>
    </main>
  );
}
