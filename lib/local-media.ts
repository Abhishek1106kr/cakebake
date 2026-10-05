/**
 * Whether the local photo folders (public/mock-assets, public/our-story) are part of this build.
 * Always on the dev server. A deployment made from this computer with the photos sets
 * NEXT_PUBLIC_LOCAL_MEDIA=1 so it looks exactly like the local site; a deployment from GitHub
 * (where the photos are not) leaves it off and shows the illustrated fallbacks.
 */
export const LOCAL_MEDIA = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_LOCAL_MEDIA === '1';
