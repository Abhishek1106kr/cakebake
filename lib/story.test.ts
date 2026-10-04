import { describe, expect, it } from 'vitest';
import images from '@/assets/manifest/images.json';
import videos from '@/assets/manifest/videos.json';
import { craft, love, memoryWall, opening, people, reviews, team, today, visibleReviews, years } from './story';
import { storyAsset, storyAssetIds } from './story-media';

describe('story content', () => {
  it('references only assets that exist in the manifest', () => {
    const used = [
      opening.film, years.maskImage, ...years.orbit.map((o) => o.asset), ...craft.steps.map((s) => s.media), people.media,
      ...memoryWall.items.flatMap((i) => (i.kind === 'media' ? [i.asset] : [])), today.film, ...love.photos.map((p) => p.asset),
      ...team.opening.map((t) => t.asset), ...team.middle.map((t) => t.asset), team.final.asset,
    ];
    for (const id of used) expect(storyAssetIds, id).toContain(id);
  });

  it('gives every asset alt text, a fallback tone and a license status', () => {
    for (const a of [...images.assets, ...videos.assets]) {
      expect(a.alt.length, a.id).toBeGreaterThan(10);
      expect(a.tone, a.id).toHaveLength(2);
      expect(a.licenseStatus, a.id).toMatch(/unknown/);
    }
  });

  it('resolves videos with posters and images with mobile crops', () => {
    const film = storyAsset('story.video.oven-rise');
    expect(film.type).toBe('video');
    expect(film.type === 'video' && film.poster).toMatch(/poster\.webp$/);
    expect(storyAsset('story.cake.drip-tiered').mobile).toMatch(/-sm\.webp$/);
    expect(() => storyAsset('nope')).toThrow();
  });

  it('never shows placeholder reviews in production', () => {
    expect(reviews.every((r) => r.mock)).toBe(true); // no real reviews supplied yet
    expect(visibleReviews('production')).toEqual([]);
    expect(visibleReviews('development').length).toBe(reviews.length);
  });

  it('attributes no quote to a named person', () => {
    for (const r of reviews) expect(r.author).toBe('Customer');
  });

  it('uses each team photograph once, with no names or roles', () => {
    const ids = [...team.opening, ...team.middle, team.final].map((t) => t.asset).filter((a) => a.startsWith('story.team.'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(6);
    expect(JSON.stringify(team)).not.toMatch(/(Chef|Head|Pastry chef|Founder)/);
  });

  it('keeps wall pieces on the canvas', () => {
    for (const i of memoryWall.items) {
      expect(i.x, i.id).toBeGreaterThanOrEqual(0);
      expect(i.y, i.id).toBeLessThan(100);
      if (i.kind === 'media') {
        expect(i.x + i.w, i.id).toBeLessThanOrEqual(100);
        expect(Math.abs(i.rotate ?? 0), i.id).toBeLessThanOrEqual(3);
      }
    }
  });
});
