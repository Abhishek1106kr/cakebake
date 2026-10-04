# Our Story (`/about`)

A digital editorial archive of the bakery: film, typography, collage and customer memories. Code: `components/story/*`, content `lib/story.ts`, media `lib/story-media.ts` + `assets/manifest/*.json`.

## Asset inventory (owner-supplied, 2026-10-04)

All files are Pinterest downloads via Klickpin. **Rights unknown: local prototype only.** They live in git-ignored `public/our-story/` (web renditions in `_web/`, built by a script; originals untouched). They are never committed or deployed. Without them, every frame falls back to its tone gradient.

| Id | What it shows | Size | Role |
|---|---|---|---|
| story.video.oven-rise | cakes rising in a warm oven | 720×1280, 3.3 s | **hero**: opening film |
| story.video.flour-sift | flour sifted into butter | 240×426, 13.5 s | craft: ingredient (low-res, shown small) |
| story.video.oven-brownie | tray bake browning | 720×1280, 2.2 s | craft: process, wall fragment (watermark: crop from top) |
| story.video.counter-cakes | decorated cakes, then a counter | 720×1280, 14.5 s | the bakery today |
| story.cake.drip-tiered | two-tier drip cake | 736×1308 | inside the 8+ numeral, craft finish, wall detail |
| story.cake.box-strawberry | strawberry cake from above, boxed | 736×1307 | wall (large), 8+ polaroid |
| story.celebration.heart-cake | heart cake, roses, one candle | 736×981 | customer love |
| story.celebration.bento-birthday | “Happy Birthday” bento in its box | 736×1308 | 8+ polaroid, wall, love |
| story.celebration.birthday-to-me | “Happy birthday to me” cake | 576×1024 | customer love |
| story.celebration.candles-wish | child making a wish | 463×500 | the people (small; **identifiable child: never in production without consent**) |
| story.celebration.gold-candles | dark cake, gold candles | 736×981 | wall, love |
| story.celebration.sparkler | sparkler, a hand lighting candles | 736×1159 | craft: serve, love |

Team chapter (`public/our-story/chefPics/`): six photos used once each (`story.team.*`); `download (5).jpg` (cat-in-a-chef-hat meme) is excluded. **Identifiable people wearing another organisation’s uniforms (ICE): reference only, never in production.** No names or roles are given.

Gaps: no Tresor-owned baker, and no real reviews. Nothing has been invented to fill them.

## Scene map

| # | Chapter | Composition | Motion |
|---|---|---|---|
| 01 | Opening | TRESOR wordmark behind and (outlined) in front of a portrait film frame; two lines + “8+ years of baking” | Scroll opens the frame (clip-path) to a portrait-cinema frame on desktop, full screen on phones; wordmark swells and fades; “This is Tresor.” |
| 02 | 8+ years | The numeral at ~42vw with the drip cake inside the type; two archival polaroids crossing it | Image drifts inside the letters with scroll; polaroids on opposite parallax; clip and scale reveals |
| 03 | Craft | Sticky: steps (Ingredient → Process → Finish → Serve), one line each; a tall frame of films and stills | Each layer wipes up over the last; line cross-fades; progress rule |
| 04 | People | Big line, short paragraph, one small tilted photo | Clip reveal, gentle parallax |
| 05 | Memory wall | Hand-placed collage (lib/story.ts positions), “Baked. Shared. Remembered.” crossing the photos, vertical archive label | Five different reveals (rise, slide, scale, clip, still), each piece at its own depth |
| 06 | Today | Text + one wide living frame | Clip reveal; film plays only in view |
| 07 | Customer love | Dark, candlelit; quotes interleaved with photos on an irregular 12-col grid | Pieces accumulate one by one with varied reveals; slower rhythm |
| 08 | Final statement | Three stepped lines; outlined TRESOR fills like ink with scroll | |
| 09 | CTA | “Ready for something sweet?” Explore the menu / Order a cake | |
| 10 | The people behind the cake | Headline beside a large portrait; cake-making, a flour film fragment; “The hands. The heat. The wait.”; portrait, the team huddle, a tilted team moment; “8+ years. Still baking by hand.”; one large final portrait; “The people make the place.” | Every tile reveals differently (clip, horizontal wipe, scale, rise, slide) at its own depth; the final portrait’s crop settles with scroll |
| — | Footer | Unchanged | |

The homepage closes with a compact Customer Love (3 photos, 3 quotes, link to the story) directly above the footer.

## Mobile

Not a shrunken desktop: the opening goes full screen (the films are portrait); the craft frame sits above its line; the wall becomes an offset column (74% / 62% widths, alternating sides) with the words between pieces; customer love becomes a 6-col sequence with photos offset left and right.

## Rules kept

- **Reviews are placeholders** (`mock: true`). They show only in development, under a visible “sample words” note. Production shows the photographs only until real reviews are added to `lib/story.ts`.
- **No invented history.** The only factual claim is 8+ years. No dates, founders or events.
- **Video:** muted, looping, inline, poster first; nothing loads until near the viewport; pauses off-screen. A still poster is shown under reduced motion or a slow connection.
- **Reduced motion:** static layouts with every line visible, applied after hydration so server and client match.
