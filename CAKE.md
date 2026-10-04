# Cake Playground (`/customize`)

Create → play → personalise → preview → save → order. The customer designs a cake and sees it change as they go. The bakery receives a precise production specification.

## Architecture

| Layer | File | Notes |
|---|---|---|
| Domain types | `lib/cake/types.ts` | `CakeConfiguration` is the product specification, renderer-agnostic, so a future 3D view reads the same object |
| Catalogue + rules | `lib/cake/config.ts` | Every option, price, production time, the print rules and the compatibility rules, **as data**. **⚠ All prices and times are SAMPLE values. Confirm with the bakery.** |
| Rules engine | `lib/cake/engine.ts` | Availability (season and live ingredient stock), compatibility (both directions, with reasons), validation, pricing, production hours, slots, summaries, share codes, sanitising |
| Uploads + artwork | `lib/cake/assets.ts` | IndexedDB in the browser; the configuration stores only an asset id |
| Designer intelligence | `engine/intelligence/cake/designer.ts` | Pairing suggestions, style presets, "Surprise me" (plain words → valid cake within budget and diet). Also learns pairings from real orders |
| Preview | `components/cake-studio/preview.tsx` + `geometry.ts` | Layered 2D SVG: extruded side (front view) and flat top view, shared outlines per shape |
| Studio | `components/cake-studio/*` | Steps Build / Decorate / Personalise / Review (free to jump between), undo/redo/reset, autosave, saved designs, share |
| Cart / order | `lib/orders.ts` (`makeCustomLine`, `CustomCakeSpec`) | Custom lines carry the full spec; ingredients draw on real stock |
| Admin | `/admin/custom-cakes`, Analytics → Cake Playground | Production sheet with print artwork; funnel, popular choices, abandonment |

## Frontend-only, and still authoritative

There is no backend (owner's rule). Instead:
- **One pricing authority.** `price(config)` in `lib/cake/engine.ts`. The cart rebuilds every custom line from its configuration on load, so a tampered stored price never survives. The add-to-bag step re-validates against live stock and the season.
- **Share links** carry the design itself (`/customize/share/<code>`), so they work on any device. **The customer's photo is never included.**
- **Customer photos** stay in that browser's IndexedDB. They are checked for type (JPG/PNG/WebP), size (≤ 8 MB) and resolution (≥ 600 px), and downscaled. They are never uploaded or reused.
- **Preview → print specification → production asset.** The SVG is only a preview. The numbers in `config.print` are the specification. `renderArtwork` draws the production PNG at 300 dpi from that specification, clipped to the printable outline.

## Rules (data, not if-statements)

- Whipped cream can't hold ruffles.
- Heart tins come in 6 to 10 inch only.
- Rectangles start at 8 inch.
- Photo prints need a 6-inch or larger, fully frosted top.
- A 4-inch cake takes no topper or macarons.
- Ganache frosting rules out the drip.
- Semi-naked cakes take no ribbon.

Seasonal options (mango) and options whose ingredients are out of stock are disabled with the reason shown.

## Production time and checkout

Base 24 h, plus time for a 10/12-inch cake, pistachio sponge, ruffles, a name topper or a photo print. Checkout offers only dated slots after the bag's longest lead time and says why.

## Analytics

Events (no personal data; message length only, never the words):
- `customizer_opened`
- `cake_started`
- `option_selected`
- `message_added`
- `image_uploaded`
- `design_saved`
- `design_shared`
- `design_reopened`
- `cake_completed`
- `custom_cake_added_to_cart`
- `custom_cake_abandoned`
- `custom_cake_ordered`

## Later

- An admin editor for `config.ts` (sizes, prices, rules, fonts, printable areas).
- A 3D preview reading the same configuration.
- Server storage for designs and uploads once a backend exists.
