// Story media registry, built from assets/manifest/*.json. Components ask for an
// asset by id (story.cake.drip-tiered), never by filename, so licensed Tresor
// photography can replace the reference files without touching any component.

import images from '@/assets/manifest/images.json';
import videos from '@/assets/manifest/videos.json';
import type { MediaAsset } from './media';

export type StoryImage = MediaAsset & { type: 'image'; focus: string; licenseStatus: string };
export type StoryVideo = MediaAsset & { type: 'video'; poster: string; focus: string; durationSec: number; licenseStatus: string };

const byId = new Map<string, StoryImage | StoryVideo>();

for (const a of images.assets) {
  byId.set(a.id, {
    id: a.id, type: 'image', src: `${images.base}/${a.desktop}`, mobile: `${images.base}/${a.mobile}`, alt: a.alt,
    aspect: `${a.aspectRatio} / 1`, priority: a.priority as MediaAsset['priority'], motionRole: 'editorial',
    tone: a.tone as [string, string], focus: a.focus, licenseStatus: a.licenseStatus,
  });
}
for (const v of videos.assets) {
  byId.set(v.id, {
    id: v.id, type: 'video', src: `${videos.base}/${v.desktop}`, poster: `${videos.base}/${v.poster}`, alt: v.alt,
    aspect: `${v.width} / ${v.height}`, priority: v.priority as MediaAsset['priority'], motionRole: 'scene',
    tone: v.tone as [string, string], focus: v.id === 'story.video.oven-brownie' ? '50% 30%' : '50% 50%', durationSec: v.durationSec, licenseStatus: v.licenseStatus,
  });
}

export function storyAsset(id: string): StoryImage | StoryVideo {
  const a = byId.get(id);
  if (!a) throw new Error(`Unknown story asset: ${id}`);
  return a;
}

export const storyAssetIds = [...byId.keys()];
