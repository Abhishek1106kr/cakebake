# Tresor: scene map and motion map

The homepage is a film in scenes, not stacked sections. It sets the visual language; the other pages adopt it afterwards.

## What felt weak before
- The hero was a decorative plate and stickers: pretty, but it says nothing about baking.
- Every section used the same "fade up on scroll", so nothing built or released.
- Products appeared as ecommerce cards (image, name, price, button).
- No scene was ever pinned, so scroll never told a story.
- The footer arrived abruptly, with no ending.

## Motion vocabulary (bakery processes, kept abstract)
| Process | Motion | Used for |
|---|---|---|
| Lamination | horizontal strips wipe in one after another, like folded layers | image entrances (craft scene) |
| Glaze | a wavy, liquid-edged mask pours down over an image | the chocolate/glaze scene |
| Proving | a slow "breath": image scale 1.0 → 1.04 → 1.0 over ~9 s | the hero at rest |
| Oven | warm light rising over an image as it enters | scene handovers |
| Crumb | tiny settle and bounce on confirmations | add to bag, bag badge |
| Steam | type that rises and loosens its tracking | big statements leaving the screen |

## Motion tokens (`lib/motion.ts`)
| Family | Duration | Easing | Feel |
|---|---|---|---|
| ui | 160–240 ms | `[0.2, 0, 0, 1]` | quick, precise |
| editorial | 700–1000 ms | `[0.22, 1, 0.36, 1]` | soft, deliberate |
| image | 1100–1600 ms | `[0.76, 0, 0.24, 1]` | heavy, cinematic |
| product | spring 220/24 | — | tactile, physical |
| page | 450–650 ms | `[0.65, 0, 0.35, 1]` | smooth, immersive |

## Homepage scene map
| # | Scene | Composition | Motion concept |
|---|---|---|---|
| 01 | **Opening** | Full-bleed macro pastry film, giant TRESOR wordmark, "Good things take time." | Image unmasks from a centre slit and settles from 1.18×; the wordmark rises letter by letter. Pinned: on scroll the camera pushes in, the wordmark's tracking widens and dissolves ("steam"), and the statement takes over. |
| 02 | **Craft** | Three words: Flour. Butter. Time. Over three images | Pinned scroll scene. Each word scrubs in; the image behind changes by **lamination** strips. |
| 03 | **Signatures** | One pastry at a time: oversized name, large image, minimal metadata | Pinned scrollytelling across three products. The name slides horizontally with scroll, the image cross-fades and turns slightly, and the price counts. |
| 04 | **Glaze** | Dark scene, chocolate macro | The **glaze** mask pours the image in on scroll; the copy follows. |
| 05 | **Discovery** | A horizontal gallery of products at varying sizes, plus "What are you in the mood for?" | Vertical scroll drives horizontal travel (pinned). Cards tilt and shift crop on hover; clicking sends the image to the product page (product transition). |
| 06 | **Story** | Editorial split: image and serif statement | Layered parallax (image, frame, caption at different speeds); statement in split words. |
| 07 | **Visit** | "COME FIND US." with location, hours, directions | Letters drop in; the map pin settles with a crumb bounce. |
| 08 | **Final statement** | Page slows: an enormous TRESOR | Scroll-scrubbed scale and tracking resolve into the wordmark just before the footer. |
| 09 | **Footer** | Existing functional footer | Unchanged. Scene 08 makes it feel like an ending. |

## Next pages (after the homepage is validated)
- **Menu:** asymmetric "product universe" that regroups on search, with an interpretation line ("Looking for something warm…").
- **Product:** campaign layout with a pinned story, horizontal macro strip and the shared image from the card.
- **Cart:** the product image morphs into the bag along an arc.
- **Checkout → confirmation → tracking:** a continuous oven-light transition family.

## Media
`lib/media.ts` is the single asset registry, with fields `id`, `type`, `src`, `mobile`, `poster`, `alt`, `aspect`, `priority` and `motionRole`. Components never hard-code paths.

While Tresor photography doesn't exist, entries point at the git-ignored local mock folder and fall back to tonal gradients when a file is missing, as in production.
