import type { Metadata } from 'next';
import { VisitActions } from '@/components/contact/visit-actions';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: 'Visit',
  description: `Visit Tresor in ${site.neighbourhood}, ${site.city}. Open ${site.hours.open}–${site.hours.close}, ${site.hours.days}.`,
  alternates: { canonical: '/contact' },
};

function MapSketch() {
  // A drawn neighbourhood sketch, not a real map. No remote map embed is loaded.
  return (
    <svg className="map-sketch" viewBox="0 0 480 360" role="img" aria-label={`Sketch of ${site.neighbourhood}`} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 250C80 230 140 260 220 236S380 180 480 200" opacity=".55" />
      <path d="M60 0c20 80 10 160 40 230s40 100 30 130M300 0c-10 70 20 120 10 190s-30 110-20 170" opacity=".4" />
      <path d="M0 110h480M0 300c120-20 240 10 480-10" opacity=".25" />
      <circle cx="248" cy="196" r="7" fill="currentColor" stroke="none" />
      <circle cx="248" cy="196" r="18" opacity=".5" />
      <text x="270" y="190" fontSize="12" stroke="none" fill="currentColor" letterSpacing="2">TRESOR</text>
    </svg>
  );
}

export default function ContactPage() {
  const unknown = 'To be announced';
  return (
    <main className="contact-page wrap">
      <Reveal><div className="eyebrow">09 / Visit</div></Reveal>
      <TextReveal as="h1" immediate delay={0.15} lines={[`${site.neighbourhood},`, `${site.city}.`]} className="page-title display visit-hero-title" />

      <div className="contact-grid">
        <Reveal className="contact-info">
          <dl className="info-list">
            <div><dt>Address</dt><dd>{site.addressLines.join(', ')}</dd></div>
            <div><dt>Hours</dt><dd>{site.hours.open} — {site.hours.close}<br />{site.hours.days}</dd></div>
            <div><dt>Phone</dt><dd>{site.phone ? <a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a> : unknown}</dd></div>
            <div><dt>Email</dt><dd>{site.email ? <a href={`mailto:${site.email}`}>{site.email}</a> : unknown}</dd></div>
          </dl>
          <VisitActions />
          <p className="contact-note">Delivery covers {site.neighbourhood} and the neighbourhoods around it. Check your PIN code in the bag.</p>
        </Reveal>
        <Reveal delay={0.1} className="map-card tone-stone">
          <MapSketch />
        </Reveal>
      </div>
    </main>
  );
}
