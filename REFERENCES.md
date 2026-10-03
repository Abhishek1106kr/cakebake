# REFERENCES — Tresor reference corpus

Research notes on the five reference captures supplied on 2026-10-04. These are **research only**: nothing in this corpus is copied into Tresor (see §7 and `THIRD_PARTY_NOTICES.md`).

The Figma V2 art direction (`#7E9291` sage, Cormorant Garamond + Inter, white-led editorial layouts) stays the foundation. Each reference below is reduced to a *principle*, and each principle is re-expressed in Tresor's own language.

---

## 0. What the corpus actually contains

All five ZIPs are **network-resource captures**, not full site saves. In every one the main HTML document is saved as `No Content`, so the page markup, section order and exact layouts are **not** in the corpus. What is there:

| Captured | Not captured |
|---|---|
| Theme CSS and JS, fonts, product and banner photography, SVG icons, third-party scripts (analytics and ad-tech) | Page HTML, section composition, copy, videos, Lottie/Rive, WebGL |

So this analysis is based on stylesheets, theme scripts, imagery and font choices. No reference contains video, Lottie, Rive, Three.js/WebGL, GSAP-driven choreography, Lenis or Framer Motion. Motion in the corpus is modest: CSS transitions, Swiper sliders and one WAAPI accordion. **Tresor's cinematic motion layer has to be original. It isn't something to extract from these sites.**

---

## 1. La Pâtisserie Cyril Lignac

**Identity**
- ZIP: `lapatisseriecyrillignac.com.zip` (68 files)
- Source: https://lapatisseriecyrillignac.com/en/
- Tech: PrestaShop with a custom `cyrillignac` theme, jQuery + hoverIntent, Swiper (with mousewheel), a product-video module (`iz_productvideo`) and a GIF-on-hover product module. Cookie consent via tarteaucitron.
- Purpose: Parisian haute-pâtisserie e-shop.

**Visually strong** (the strongest photography in the corpus)
- **Macro texture as hero.** The slider images are extreme close-ups: lacquered caramel tart shells, a split chocolate filling. Texture *is* the headline, and no full product is shown.
- **Diptych composition.** Two macro crops sit side by side with a hard seam, which feels editorial rather than commercial.
- **One object on a toned seamless backdrop.** Each product is shot alone on a dusty-rose paper sweep, lit softly from one side. The catalogue reads as one photographic series.
- Warm, low-saturation colour, with no props.

**Technically strong**
- Product video opens in an overlay on demand. The video plays on click, and closing pauses it and resets `currentTime`, so nothing autoplays.
- hoverIntent delays mega-menu opening so the menu doesn't flicker as the cursor passes over.

**What can inspire Tresor**
- *Principle: texture tells you how something tastes before the name does.*
  - Tresor version: macro loops generated with Higgsfield (laminated croissant layers, crema forming) used as **narrow section transitions**. A thin vertical slit of video opens with `clip-path` as you scroll, rather than full-bleed sliders.
  - Better than the reference: scroll-linked, short, posters first, and static under reduced motion.
- *Principle: a consistent single-object photographic series makes a menu feel curated.*
  - Tresor version: every product shot alone on a **stone/sage seamless** (`#DDE3E1` / `#EFE8DD`) with soft daylight. Generated as placeholders until real photography exists.
- *Principle: video only on request.*
  - Tresor version: "Watch it being made" on the product page opens a 6–8 s clip in an `AnimatePresence` modal with focus trapping and Esc to close.

**Do not copy**
- The rose/brown seamless colour.
- The tart and chocolate diptych crops.
- Lignac's slider-led home page.
- Its typography and logo.
- Any photograph.

---

## 2. Belagio

**Identity**
- ZIP: `belagio.in.zip` (237 files)
- Source: https://belagio.in/
- Tech: Shopify with the **Minimog** commercial theme (`m-` prefixed components, `--m-duration-default: .25s`), Swiper, Instafeed widget, Space Grotesk plus a custom heading face (Fahkwang).
- Purpose: Indian luxury entremet and cake brand.

**Visually strong**
- **Annotated cross-section** (`rose-chocolate-truffle-belagio-detail`). A sliced cake has hairline leader lines to small caps labels for each layer: *dark chocolate mousse, chocolate almond sponge, cocoa butter spray*. It explains craft and justifies price in one image.
- **Pedestal still life.** Entremets sit on cream plinths in raking daylight with long soft shadows: gallery-like, calm and premium.
- Wide-tracked serif capitals for collection titles ("BERRY COLLECTION").
- Warm ivory `#FFFBF3` with bronze `#806023` / `#775F32` accents.

**Technically strong**
- The banner reveal is a CSS-only stagger: the subtitle, title, description and button get `transition-delay` 0.1s, 0.2s, 0.3s and 0.4s when the slide becomes active. It's cheap, but they're four unrelated fades.

**What can inspire Tresor**
- *Principle: show the inside, because craft is the justification.*
  - Tresor version: an **"Inside" module** on the product page. The product image stays sticky while sage hairlines draw in one at a time on scroll (SVG `pathLength` with `useScroll`). Each line ends in a tiny Inter caps label with a fact, e.g. *"27 layers · 72-hour lamination"*.
  - Better than the reference: interactive, part of the narrative, and the labels are real DOM text (accessible and indexable). Reduced motion shows all labels at once, and mobile shows a stacked list.
- *Principle: give premium objects a stage.*
  - Tresor version: the home page "Signatures" section shows products on simple paper and stone plinths in Tresor's neutral palette, as one composition rather than a carousel.
- *Principle: orchestrate entrances.*
  - Tresor version: replace delay-stacked fades with **one orchestrated Framer Motion sequence** (parent variants with `staggerChildren`) that follows the brief's hero timeline, can be interrupted, and respects reduced motion.

**Do not copy**
- The gold leader-line label style and its placement over the photo.
- The plinth arrangement.
- Wide-tracked serif collection titles. Tresor uses tracked *Inter* micro caps and Cormorant in sentence case.
- The bronze/ivory palette.
- Category structure (anniversary, floral, corporate…).
- Any photograph.

---

## 3. Amintiri

**Identity**
- ZIP: `amintiri.in.zip` (222 files)
- Source: https://amintiri.in/
- Tech: Shopify with the same **Minimog** theme (custom elements `deferred-media`, `m-video-component`, `m-search-popup`, `m-quantity-input`, `product-recently-viewed`), Swiper, luxon, a custom **timeslot** script, GoKwik checkout. Fonts: Karla, Jost, Futura.
- Purpose: Indian premium bakery, cakes and gifting.

**Visually strong**
- **Dark candlelit still life.** Deep teal packaging with gold foil, tapered candles and a chocolate-brown backdrop. Packaging is treated as the hero, which suits gifting.
- A tight palette: teal `#0A6169`, gold `#C4AB3F`, cream `#FBF6E9`.

**Technically strong**
- **Delivery time-slot logic** (`timeslot.js`). It computes the current time in `Asia/Kolkata`, populates cities, fetches available slots and caches them in a cookie/localStorage. This is real commerce logic that customers feel.
- `deferred-media`: video and iframes load only on interaction, keeping the first load light.
- Recently viewed products are stored client-side.

**What can inspire Tresor**
- *Principle: honest delivery promises.*
  - Tresor version (frontend-only business logic): slot availability computed in the browser from the current IST time plus the prep lead time of the cart. Past and too-soon slots are disabled with a reason, e.g. *"Order by 4:30 pm for 6–8 pm"*.
  - Better than the reference: no network round trip, and the reason is always shown rather than slots silently disappearing.
- *Principle: an evening register.*
  - Tresor version: one late-day section built on the `evening-atmosphere` video (warm, low light, sage still dominant). It's a mood shift within one identity, not a dark theme.
- *Principle: defer heavy media.* This becomes Tresor's `<VideoHero>` / `<LazyVideo>`: poster first, sources attached on intersection, only one video playing at a time.

**Do not copy**
- The teal/gold palette and foil-box styling.
- The candles still life.
- The Minimog component structure.
- Gifting-hamper merchandising.
- Any photograph.

---

## 4. Paris Baguette

**Identity**
- ZIP: `parisbaguette.com.zip` (69 files)
- Source: https://parisbaguette.com/
- Tech: WordPress with the Genesis framework, a custom `paris-baguette-2024` theme, Genesis Blocks, jQuery, superfish menus, and a WAAPI accordion (`animate-details.js`). Custom brand fonts (`pb_signature`, `pb_special_elite`) and Source Sans Pro.
- Purpose: international bakery-café chain (US site).

**Visually strong**
- Bright, honest lifestyle photography on marble: torn croissant crumb, berries, branded cups. Commercial but appetising.
- Strong brand system (navy `#001E60` + yellow `#FFC600`) with texture overlays (`pb-grunge.png`, a beige paper texture).

**Technically strong**
- **Accessible animated accordion.** It keeps native `<details>/<summary>` semantics and animates height with the Web Animations API (400 ms ease-out), including cancelling a running animation when the user reverses mid-way.
- Every product block has two clear calls to action: order online, or view the menu.

**What can inspire Tresor**
- *Principle: animate without breaking semantics.*
  - Tresor version: product details (ingredients, allergens, storage, "how to enjoy") use native disclosure semantics with a Framer Motion height animation (`height: auto`, 220–280 ms) that can be interrupted.
- *Principle: never make the customer hunt for the order path.*
  - Tresor version: one primary path (Tresor delivery) and a quiet secondary row for Zomato / Swiggy, with a 150–400 ms "Ordering through SWIGGY →" redirect transition.
- *Principle: seasonal freshness.*
  - Tresor version: a small "This week at Tresor" editorial rail. Data-driven from `data/products.ts` tags, not hard-coded banners.

**Do not copy**
- The navy/yellow system and grunge textures.
- Signature fonts and the PB monogram.
- Chain-restaurant lifestyle photography.
- The rewards app promotion.
- The Genesis layouts.

---

## 5. Bakingo

**Identity**
- ZIP: `www.bakingo.com.zip` (202 files)
- Source: https://www.bakingo.com/
- Tech: React SSR (code-split chunks: `HomePage`, `InstaStory`, `PromotionalBanner`), Isidora Sans (commercial font), Font Awesome, a Lottie reference, and **30+ ad-tech and sync domains** (Criteo, PubMatic, Taboola, Outbrain, DoubleClick…).
- Purpose: mass-market cake delivery across India.

**Visually strong**
- Clear and instantly legible, but promotional: a big banner, a red `#FC0015` "ORDER NOW" button, a scalloped edge, sparkle illustrations. This is the grocery-app look the brief explicitly rejects.

**Technically strong** (commerce depth, not aesthetics)
- Feature vocabulary found in the code: *occasion* (68 mentions), *express*, *add-ons*, *reminder*, *personalise*, *pincode*, *eggless*, *midnight delivery*, *recently viewed*.
- Route-level code splitting keeps the home page bundle separate.

**What can inspire Tresor**
- *Principle: answer the practical questions up front.* Tresor keeps the useful parts, presented quietly:
  - an **eggless / vegetarian** dietary tag and filter;
  - a **"Note on the box"** field (short message, character limit);
  - a **Bengaluru PIN serviceability check** in the cart (frontend data);
  - "recently viewed" stored client-side.
- *Principle: performance is a brand signal.* Tresor ships **no third-party trackers**, which is the opposite of the reference.

**Do not copy**
- The promo-banner aesthetic, red CTA, scallops, sparkles and discount noise.
- Occasion-heavy navigation.
- Instagram-story widgets.
- Isidora Sans.
- Any banner or photograph.

---

## 6. Synthesis: one Tresor language, not a collage

| Tresor decision | Derived principle | Source(s) | How Tresor makes it its own and better |
|---|---|---|---|
| White-led editorial pages with sage accents (Figma V2) | — | Figma V2 | Unchanged foundation |
| Single-object stone/sage product series | Consistent series = curation | Lignac | Tresor neutrals, generated until real shoots exist |
| "Inside" anatomy module | Show craft to justify price | Belagio | Scroll-drawn sage hairlines, real text, reduced-motion fallback |
| Macro "texture slit" section transitions | Texture before name | Lignac | Short Higgsfield loops, `clip-path` scroll reveal, lazy |
| One orchestrated hero sequence | Choreographed entrance | Minimog (Belagio/Amintiri) | Framer Motion variants on the brief's timeline, interruptible |
| Evening register section | Mood shift | Amintiri | Same identity, warm low light, one video |
| IST delivery slots with reasons | Honest promises | Amintiri | Frontend-only, prep-time aware, explains disabled slots |
| Animated native disclosures | Motion without breaking semantics | Paris Baguette | Framer Motion `height: auto`, interruptible |
| One primary order path + quiet Zomato/Swiggy | Clear order path | Paris Baguette | Short redirect transition, env-configured URLs |
| Dietary tags, box note, PIN check, recently viewed | Practical answers up front | Bakingo | Quiet presentation, no promo noise |
| No trackers, lazy media, poster-first video | Performance as a brand signal | Bakingo (as a counter-example), Amintiri | Budget: one primary animation per viewport |

**Originality guardrails**
- No section mirrors a reference's composition.
- No reference palette or font appears.
- No reference photograph, icon or logo is used.
- Motion choreography follows the Tresor brief, not any reference.

---

## 7. Asset and licence audit

| Asset class (all five sites) | Licence status | Decision |
|---|---|---|
| Product, banner and lifestyle photography | Proprietary to each brand | **Not used.** Recreate the idea with original or generated assets |
| Logos, monograms, packaging | Trademarks | **Not used** |
| Brand fonts: `pb_signature`, `pb_special_elite`, Fahkwang file copies, M-Heading-Font, Isidora Sans, icomoon | Proprietary / commercial / unclear | **Not used** |
| Open fonts present: Karla, Jost, Roboto, Source Sans Pro, Space Grotesk | SIL OFL / Apache 2.0 | Legally reusable but **not needed**: Tresor uses Cormorant Garamond + Inter |
| Libraries: jQuery, Swiper, luxon, hoverIntent | MIT | **Not used.** Framer Motion + native APIs cover the needs |
| Theme code (Minimog, Genesis/PB theme, Cyril Lignac theme, Bakingo bundles) | Proprietary / commercial | **Not used**, studied for technique only |
| Analytics and ad-tech scripts | Third-party | **Never included** |

Result: **zero assets from the corpus enter the Tresor codebase.**
