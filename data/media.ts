// Editorial media slots. Every slot renders a soft-colour fallback until real
// assets exist. To go live, drop files into public/media and fill in src/poster here.
// Layouts never change when assets arrive.

export type MediaSlot = {
  /** MP4 (H.264) loop, ideally 4–10 s and under ~4 MB. */
  src?: string;
  /** Optional WebM alternative. */
  webm?: string;
  /** Still frame shown before playback, under reduced motion and on slow connections. */
  poster?: string;
  /** Describes the scene; empty when the media is purely decorative. */
  alt: string;
};

export const media = {
  heroCafe: { alt: '' } as MediaSlot, // planned: public/media/hero-cafe.mp4
  textureLamination: { alt: '' } as MediaSlot, // planned: public/media/pastry-closeup.mp4
  coffeePour: { alt: '' } as MediaSlot, // planned: public/media/coffee-pour.mp4
  interiorMorning: { alt: 'The café in morning light' } as MediaSlot, // planned: public/media/interior-morning.mp4
  eveningAtmosphere: { alt: '' } as MediaSlot, // planned: public/media/evening-atmosphere.mp4
} satisfies Record<string, MediaSlot>;
