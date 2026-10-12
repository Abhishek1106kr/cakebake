/**
 * Whether the local photo folders (public/mock-assets, public/our-story) are part of this build.
 * Always on the dev server. A deployment made from this computer with the photos sets
 * NEXT_PUBLIC_LOCAL_MEDIA=1 so it looks exactly like the local site; a deployment from GitHub
 * (where the photos are not) leaves it off and shows the illustrated fallbacks.
 */
export const LOCAL_MEDIA = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_LOCAL_MEDIA === '1';

/** False for a git-ignored local photo in a build without them, so callers show the fallback without a 404. */
export function mediaAvailable(src: string | undefined): src is string {
  if (!src) return false;
  return LOCAL_MEDIA || !(src.startsWith('/mock-assets/') || src.startsWith('/our-story/'));
}
