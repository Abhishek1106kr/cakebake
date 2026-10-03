# CLAUDE.md — Tresor Customer Website

> **Project:** Tresor — premium café / bakery customer-facing commerce website
> **Source of truth:** Figma **Tresor — Art Direction v2**
> **Primary implementation stack:** Next.js App Router + TypeScript + React + Framer Motion
> **Visual identity:** `#7E9291` / `#657876` / `#FFFFFF` with restrained supporting neutrals
> **Primary objective:** turn the Figma V2 art direction into a **real, premium, cinematic, highly interactive customer website** — not a static mockup and not an "AI-looking" template.

---

## 0. Non-negotiable Product Direction

Build Tresor like a real premium café brand with a strong digital identity.

The final site must feel:

- cinematic
- editorial
- tactile
- warm
- premium
- contemporary
- playful in small details
- fast and trustworthy for commerce

It must **not** feel like:

- an AI-generated website
- a SaaS dashboard
- a generic Shopify template
- a grocery-delivery clone
- a glassmorphism template
- a collection of giant rounded cards
- a motion demo where animation exists only for decoration

### Design principle

> **Photography + typography + whitespace + composition + subtle interaction + commerce clarity.**

The site should feel expensive because the art direction is good, not because it has gradients, glowing effects, 3D widgets, or excessive animation.

---

# 1. Source of Truth: Figma V2

The Figma V2 art direction defines the visual language and page composition.

Figma file:

`https://www.figma.com/design/S4HRo64X5K3Xa6xrhJJnGa`

Relevant page:

`Tresor — Art Direction v2`

### V2 screens

1. `V2 · 01 HOME`
2. `V2 · 02 MENU`
3. `V2 · 03 PRODUCT`
4. `V2 · 04 CART`
5. `V2 · 05 CHECKOUT`
6. `V2 · 06 CONFIRMATION`
7. `V2 · 07 TRACKING`
8. `V2 · 08 ABOUT`
9. `V2 · 09 CONTACT`
10. `V2 · 10 ACCOUNT`

### Important

Do **not** redesign the site away from V2 while coding.

You may improve usability, responsiveness, accessibility and motion, but preserve the V2 visual identity, composition, hierarchy and tone.

---

# 2. Existing Project Context

The current project is already structured as a Next.js App Router application with:

- Next.js 15
- React 19
- TypeScript
- Framer Motion
- Lucide React
- CSS variables
- responsive CSS
- local state
- localStorage cart

Current route structure:

```text
app/
├── page.tsx
├── menu/page.tsx
├── product/[slug]/page.tsx
├── cart/page.tsx
├── checkout/page.tsx
├── order/[id]/page.tsx
├── track/[id]/page.tsx
├── about/page.tsx
├── contact/page.tsx
├── account/page.tsx
└── not-found.tsx
```

Existing reusable components include:

```text
components/
├── header.tsx
├── footer.tsx
├── product-card.tsx
├── store.tsx
└── animations.tsx
```

Before adding new abstractions, inspect the existing implementation and extend/refactor it where appropriate.

Do **not** duplicate logic unnecessarily.

---

# 3. Core Customer Journey

The primary conversion path is:

```text
HOME
  ↓
MENU
  ↓
SEMANTIC SEARCH / CATEGORY
  ↓
PRODUCT
  ↓
ADD TO CART
  ↓
CART
  ↓
CHECKOUT
  ↓
PAYMENT
  ↓
ORDER CONFIRMATION
  ↓
LIVE ORDER TRACKING
```

Secondary flows:

```text
HOME → ABOUT
HOME → CONTACT / VISIT
HOME → ZOMATO
HOME → SWIGGY
HOME → ACCOUNT
ACCOUNT → ORDER HISTORY
ACCOUNT → SAVED ADDRESSES
```

The website is a **mock/production-ready frontend** at this stage.

Payment must remain explicitly simulated until the backend/payment gateway is connected.

Never present a fake payment as a real completed transaction.

---

# 4. Brand System

## Colors

```css
--color-brand: #7E9291;
--color-brand-dark: #657876;
--color-brand-light: #A9B7B6;
--color-white: #FFFFFF;
--color-surface: #F6F8F7;
--color-ink: #202625;
--color-muted: #687270;
--color-border: #DDE3E1;
--color-warm: #EFE8DD;
--color-cream: #F8F4EC;
```

### Usage ratio

Approximately:

```text
70% white / neutral
20% supporting surfaces / imagery tones
10% brand sage
```

Do not turn the whole site sage green.

Sage is the signature accent and should be used for:

- hero editorial panels
- active controls
- primary CTAs
- order states
- selected search chips
- key emphasis sections

### Prohibited visual treatments

Do not introduce:

- neon gradients
- purple/pink AI gradients
- glassmorphism
- chrome effects
- excessive blur
- glowing cards
- excessive drop shadows
- rainbow accents

---

# 5. Typography

Use:

### Display

`Cormorant Garamond`

Use for:

- hero headlines
- product titles
- editorial statements
- large prices when appropriate
- confirmation messages

### UI / Body

`Inter`

Use for:

- navigation
- body copy
- labels
- controls
- metadata
- checkout fields
- order statuses

### Typographic behavior

Use dramatic scale changes intentionally:

- tiny uppercase metadata
- medium body text
- large editorial headings
- occasional huge hero statements

Do not make every section huge.

Typography is part of the composition.

---

# 6. Framer Motion Philosophy

This project should use **Framer Motion as a design system**, not sprinkle random `whileHover` effects everywhere.

Import from the installed package:

```ts
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
```

## Motion principle

Every animation must answer at least one of these:

1. What just happened?
2. Where did this object come from?
3. What should I look at next?
4. Is the system working?
5. What changed because of my action?
6. Does this make the brand feel more tactile?

If an animation does none of these, remove it.

---

# 7. Motion Timing System

Use a predictable motion scale.

```text
Micro feedback:       100–160ms
Button feedback:      140–220ms
Card interactions:    180–300ms
Dropdowns:             180–280ms
Modal / drawer:       220–360ms
Page transitions:     350–650ms
Hero choreography:    700–1400ms
Cinematic transitions: 1200–2200ms
```

Preferred easing:

```ts
const EASE = [0.22, 1, 0.36, 1];
```

Use ease-out for entering UI and controlled ease-in/out for exits.

Do not make ordinary interactions wait for cinematic timings.

---

# 8. Global Page Transition

Every route transition should feel intentional.

Create a shared transition layer using `AnimatePresence`.

Concept:

```text
current page
   ↓
subtle sage veil / image fragment
   ↓
new page reveals
```

Preferred behavior:

- exit: 180–300ms
- transition layer: 250–450ms
- enter: 400–650ms

### Do not use

A full-screen black flash.

Instead use Tresor white + sage.

---

# 9. Initial Website Loading Experience

Create a custom `TresorLoader`.

The loader should be elegant and very short.

### Concept

```text
white screen

        T
      T R E
    T R E S O R

      loading
      · · ·
```

Alternative cinematic state:

- wordmark slowly resolves from opacity 0 → 1
- thin sage progress line grows from 0 → 100%
- content reveals through a masked vertical wipe

Target duration:

```text
600–1200ms
```

Never hold the user unnecessarily.

If the app loads immediately, use a shorter 250–500ms branded reveal.

---

# 10. Redirect / Navigation Animation

Use a tiny intentional transition when navigation feels like a destination change.

Example:

```text
clicked MENU
   ↓
button label fades
   ↓
current content shifts slightly left
   ↓
sage accent sweeps across
   ↓
MENU enters from right
```

Keep it subtle.

Navigation should feel fast.

---

# 11. Home Page Motion

The home page is the flagship experience.

It should feel like a **30-second brand film that happens to be interactive**.

## Hero choreography

Sequence:

```text
0ms      page background appears
150ms    top navigation fades in
250ms    hero image starts masked reveal
450ms    hero headline line 1 appears
580ms    hero headline line 2 appears
720ms    supporting copy appears
850ms    CTA appears
1000ms   small editorial detail enters
```

Use:

- clip-path or masked reveal
- opacity
- y translation
- subtle scale from 1.04 → 1.0

Do not animate text letter-by-letter unless it genuinely improves the composition.

---

# 12. Cinematic Video / Higgsfield Integration

We may create short cinematic assets using **Higgsfield** or another video-generation tool.

The generated videos should become actual local website assets, not API dependencies.

Recommended directory:

```text
public/
└── media/
    ├── hero-cafe.mp4
    ├── coffee-pour.mp4
    ├── pastry-closeup.mp4
    ├── interior-morning.mp4
    ├── evening-atmosphere.mp4
    └── texture-loop.mp4
```

Use `<video>` or a React video component.

### Hero video rules

- autoplay
- muted
- playsInline
- loop
- preload metadata/auto depending on size
- poster image fallback

Example:

```tsx
<video
  autoPlay
  muted
  loop
  playsInline
  poster="/media/hero-cafe-poster.jpg"
>
  <source src="/media/hero-cafe.mp4" type="video/mp4" />
</video>
```

### Critical performance rule

Never put a 40–100 MB video above the fold.

Prefer:

- short 4–10 second loops
- compressed H.264/WebM where useful
- poster images
- lazy loading for below-fold video
- reduced-motion/static fallback

### Video role

Video should be used as:

- hero atmosphere
- section transitions
- product/editorial storytelling
- background texture
- loading/reveal experience where appropriate

Do not turn every section into video.

---

# 13. Framer Motion + Video Combination

For hero sections, combine video with motion rather than replacing motion with video.

Example:

```text
VIDEO
  ↓
slow scale
  ↓
mask reveal
  ↓
text enters
  ↓
parallax detail
```

The video itself should remain relatively calm.

Motion provides the interaction.

Video provides the atmosphere.

---

# 14. Scroll Storytelling

Use `useScroll()` and `useTransform()` selectively.

Good uses:

- hero image scale
- image parallax
- editorial headline movement
- progress indicator
- section reveal
- product image drift

Bad uses:

- every element moves independently
- excessive horizontal scrolling
- dizziness
- infinite parallax layers

### Example

```ts
const { scrollYProgress } = useScroll({ target: ref });
const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1]);
```

Use springs where movement needs tactile weight.

---

# 15. Cute Microinteractions

Tresor should have small moments of personality.

These should feel **cute**, not childish.

## Add to cart

Instead of simply changing button text:

```text
ADD TO CART
      ↓
✓ ADDED
```

Animate:

- button width subtly
- checkmark draw-in
- cart count increment
- product image mini-fly toward the cart/bag

Target duration:

`250–500ms`

## Cart count

When quantity changes:

- number scales 1 → 1.2 → 1
- slight vertical movement

## Favourite / save

If implemented:

- small shape morph
- gentle scale
- no giant heart explosion

## Search suggestions

Suggestion chips should enter with tiny staggered movement.

---

# 16. Menu Page

The menu is a key experience.

### Semantic search

Do not make it look like an AI product demo.

UI should say:

> **What are you in the mood for?**

Users can enter:

- something chocolatey
- warm and nutty
- something cold
- light brunch
- not too sweet

Mock semantic ranking should reorder results.

### Search result animation

When query changes:

- previous products fade/slide out
- matching products reposition using `layout`
- matched products receive a subtle highlight
- result count changes smoothly

Use:

```tsx
<LayoutGroup>
  <AnimatePresence mode="popLayout">
    ...
  </AnimatePresence>
</LayoutGroup>
```

The feeling should be:

> "The website understood me."

not:

> "I am interacting with an AI widget."

---

# 17. Product Card Motion

Default:

- restrained
- editorial

Hover:

```text
image scale: 1 → 1.035
caption y: 0 → -3px
price opacity: 0.8 → 1
```

Optional cursor-follow image drift can be used on desktop only.

Do not use aggressive 3D tilt.

---

# 18. Product Detail Page

The product page should feel almost like an editorial product campaign.

### Gallery

Use:

- image crossfade
- zoom on hover
- thumbnail reveal
- smooth active state

### Add to cart

Primary action must remain obvious.

After click:

1. button locks briefly
2. subtle progress state
3. checkmark
4. price/order information updates
5. bag count animates
6. optional mini cart toast

---

# 19. Cart Page

V2 uses the darker order/bag surface.

Preserve this.

Interactions:

- quantity +/-
- remove item
- subtotal update
- delivery fee update
- total update
- checkout CTA

Use `AnimatePresence` when removing items.

### Removing a product

Sequence:

```text
row compresses
→ opacity out
→ nearby rows close gap
→ total count updates
```

The layout should smoothly reflow.

---

# 20. Checkout

Checkout must be calm and trustworthy.

Do not over-animate forms.

Use subtle feedback for:

- focus
- validation
- payment selection
- loading
- success
- error

### Payment simulation

State machine:

```text
IDLE
→ PROCESSING
→ SUCCESS
```

Error path:

```text
PROCESSING
→ FAILED
→ RETRY
```

Never simulate a successful payment without an explicit "mock/prototype" implementation detail in code/content.

---

# 21. Cute Checkout Loading Screen

Optional full-screen transition:

```text
Preparing your order

     ○
   ○   ○
     ○

A little moment...
```

But keep it under about 1 second unless a real request is being processed.

For actual asynchronous requests, use real progress/loading states.

---

# 22. Order Confirmation

This is a major delight moment.

Use V2's sage/dark composition.

Recommended motion sequence:

```text
background enters
↓
order number fades in
↓
confirmation headline rises
↓
status badge appears
↓
ETA counter appears
↓
CTA reveal
```

Optional:

A very subtle line-art mark or ring can animate once.

No confetti.

Tresor is a café, not a SaaS onboarding flow.

---

# 23. Order Tracking

The timeline is a live state visualization.

States:

```text
NEW
→ CONFIRMED
→ PREPARING
→ READY
→ OUT FOR DELIVERY
→ DELIVERED
```

Each status should have:

- icon/number
- label
- timestamp or state copy
- active indicator

### Active step animation

Use a tiny pulse or ring, not a blinking light.

Example:

```text
outer ring expands
opacity 0.45 → 0
repeat slowly
```

Only one active status should animate.

---

# 24. About Page

This should feel like a brand film/editorial page, not a corporate About Us page.

Use:

- large image/video block
- serif statement
- small metadata
- scroll reveals
- restrained parallax

Potential narrative sequence:

```text
THE HOUSE
↓
A PLACE TO STAY A LITTLE LONGER.
↓
THE DETAILS
↓
COFFEE / PASTRY / CONVERSATION
```

---

# 25. Contact / Visit

Keep it useful.

Include:

- address
- opening hours
- phone
- email
- map
- directions
- Zomato
- Swiggy

Zomato and Swiggy links should be configurable through environment variables.

```env
NEXT_PUBLIC_ZOMATO_URL=
NEXT_PUBLIC_SWIGGY_URL=
```

Do not invent real restaurant URLs.

---

# 26. Account

Keep account UI consistent with the V2 dark treatment.

Include:

- profile
- orders
- saved addresses
- payment methods placeholder
- privacy
- logout

Order history should feel like the same product ecosystem, not an unrelated dashboard.

---

# 27. Responsive Design

Do not simply shrink desktop.

### Desktop

Large editorial compositions.

### Tablet

Reduce asymmetry while preserving the visual rhythm.

### Mobile

Recompose intentionally.

Use:

- sticky cart/bag actions
- compact header
- stacked hero composition
- touch-friendly controls
- bottom sheets for contextual actions where helpful
- sticky checkout summary when appropriate

Minimum interactive target:

`44 × 44px`

---

# 28. Accessibility and Reduced Motion

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  /* simplify transitions */
}
```

In Framer Motion:

```ts
const shouldReduceMotion = useReducedMotion();
```

When reduced motion is enabled:

- remove parallax
- remove large scale changes
- remove page-film transitions
- keep opacity transitions short or use no transition
- disable auto-moving decorative elements

Do not remove functionality.

---

# 29. Performance Rules

A visually rich site still needs to feel fast.

### Critical

- optimize images
- use `next/image`
- use responsive image sizes
- use posters for videos
- lazy load below-the-fold media
- do not load every video on initial render
- defer non-critical animations
- avoid giant JS animation libraries beyond Framer Motion already installed
- avoid expensive mousemove handlers running at full frequency
- use `requestAnimationFrame` or Motion values when needed

### Video budget

Keep hero loops short and compressed.

Do not autoplay multiple videos simultaneously.

### Animation budget

At most:

- one primary cinematic animation
- a few supporting microinteractions

per viewport.

---

# 30. Architecture for Motion

Create reusable motion primitives.

Recommended structure:

```text
components/
└── motion/
    ├── page-transition.tsx
    ├── reveal.tsx
    ├── image-reveal.tsx
    ├── text-reveal.tsx
    ├── stagger.tsx
    ├── fade-slide.tsx
    ├── magnetic-button.tsx
    ├── add-to-cart-animation.tsx
    ├── cart-count.tsx
    ├── video-hero.tsx
    ├── loading-screen.tsx
    └── route-loader.tsx
```

### Motion variants

Centralize variants rather than duplicating values.

Example:

```ts
export const revealUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};
```

---

# 31. Suggested Motion Components

Build these reusable primitives:

### `<PageTransition />`
Route transitions.

### `<Reveal />`
Viewport reveal.

### `<ImageReveal />`
Masked image entrance.

### `<TextReveal />`
Editorial headline animation.

### `<StaggerGroup />`
Staggered children.

### `<MagneticButton />`
Very subtle desktop-only pointer attraction.

### `<VideoHero />`
Responsive background/foreground video with poster fallback.

### `<OrderState />`
Animated status timeline.

### `<CartFlyToBag />`
Product-to-bag microinteraction.

### `<BrandLoader />`
Initial loading.

---

# 32. Magnetic Interaction Rules

A magnetic button is acceptable for:

- primary hero CTA
- major order CTA
- menu CTA

Do NOT apply it to:

- every button
- checkout inputs
- navigation links
- mobile UI

Movement should be subtle:

```text
max translation: 4–8px
```

---

# 33. Cursor Effects

Desktop only.

Optional:

- subtle custom cursor dot
- cursor-follow image preview for certain editorial links
- magnetic CTA

Never compromise usability.

Disable entirely on touch devices.

---

# 34. Hover Image Preview

For editorial links such as:

```text
MENU
PASTRY
COFFEE
ABOUT
```

A small floating image preview can appear near the cursor.

Motion:

- opacity
- scale
- x/y spring

Keep it subtle and low-frequency.

Do not introduce this into checkout/account.

---

# 35. Loading / Skeleton States

Create actual states, not blank screens.

Components that need skeleton states:

- menu
- product details
- order tracking
- account order history

Skeleton style:

- white / soft gray / sage accent
- low contrast
- shimmer only when necessary

Do not overuse animated skeletons.

---

# 36. Empty States

Examples:

### Empty cart

> Your bag is waiting.

CTA:

`EXPLORE MENU`

### No search matches

> Nothing quite fits that mood yet.

Actions:

`BROWSE MENU`
`TRY ANOTHER MOOD`

Use a small cute illustration or editorial detail if appropriate.

---

# 37. Error States

Never dump technical error messages on customers.

Use clear copy.

Example:

> Something went off-script.
>
> Your order is still safe. Please try again.

Provide recovery CTA.

---

# 38. Business Logic

## Cart

Persist cart locally.

Requirements:

- add product
- increase/decrease quantity
- remove product
- subtotal
- delivery fee
- total
- item count

## Order

Generate mock order IDs:

```text
TRS-XXXX
```

## Tracking

Use mock order state transitions.

For demo mode, allow timed progression or manual debug controls in development.

---

# 39. Payment

At this stage payment is simulated.

Do not integrate fake transaction success behind a deceptive UI.

Provide:

```text
idle
processing
success
failure
retry
```

When backend/payment is later connected, replace the mock layer behind a clean service boundary.

---

# 40. Search

Implement a deterministic semantic-style search mock.

Example intent mapping:

```text
chocolatey → chocolate / cocoa / tart
warm → coffee / cinnamon / pastry
nutty → almond / pistachio / hazelnut
cold → cold brew / iced
light → tea / pastry / fresh
brunch → toast / sandwich / eggs
```

The UI should feel semantic even before embeddings/backend search exist.

Do not put "AI-powered" labels everywhere.

---

# 41. Zomato / Swiggy Integration

Use external links for now.

```ts
const zomatoUrl = process.env.NEXT_PUBLIC_ZOMATO_URL;
const swiggyUrl = process.env.NEXT_PUBLIC_SWIGGY_URL;
```

Open external destinations safely.

Never hard-code invented URLs.

---

# 42. Image / Video Asset Strategy

Preferred structure:

```text
public/
├── images/
│   ├── products/
│   ├── editorial/
│   ├── interior/
│   └── brand/
└── media/
    ├── hero-cafe.mp4
    ├── coffee-pour.mp4
    ├── interior-morning.mp4
    └── pastry-closeup.mp4
```

When real Tresor assets are supplied, replace placeholders rather than changing layout logic.

Do not use remote images in production unless explicitly approved.

---

# 43. Image Fallback Strategy

Every large visual should have:

1. real image/video if available
2. poster image
3. soft-color fallback
4. meaningful `alt` text where appropriate

Decorative video should use empty alt semantics / presentation treatment.

---

# 44. SEO

The site should have proper metadata per page.

At minimum:

- title
- description
- canonical strategy
- OG title
- OG description
- OG image

Product pages should include structured metadata when product details become real.

Use semantic HTML.

---

# 45. Code Quality

Prefer:

- small reusable components
- typed data models
- no duplicated pricing logic
- no duplicated animation constants
- server components where possible
- client components only where interaction requires them
- clear separation of data and UI

Avoid:

- giant page components
- hundreds of inline motion values
- deeply nested conditionals
- duplicated product definitions
- hard-coded totals in multiple components

---

# 46. Do Not Over-Engineer

This is a premium café website, not a distributed operating system.

Do NOT introduce:

- microservices
- Kafka
- unnecessary state libraries
- complicated event buses in the frontend
- heavy animation engines beyond Framer Motion
- WebGL unless a specific effect actually needs it

Keep the frontend elegant.

---

# 47. Framer vs Framer Motion Clarification

The implementation target is the **existing Next.js website**.

Use **Framer Motion** for React animation.

If the team later chooses to publish through Framer's site builder, the visual system and motion principles should remain transferable, but do not rewrite the current Next.js architecture just to imitate Framer's platform.

---

# 48. Development Workflow

Before editing:

1. Inspect existing route/component structure.
2. Inspect the V2 Figma screens.
3. Identify the relevant reusable component.
4. Implement the smallest architecture change needed.
5. Test desktop and mobile.
6. Check reduced motion.
7. Check keyboard/focus behavior.
8. Validate the customer journey end-to-end.

---

# 49. QA Checklist

## Visual

- Does the page look like V2?
- Is `#7E9291` used intentionally?
- Is whitespace preserved?
- Do hero proportions feel editorial?
- Are typography weights correct?
- Are images given enough prominence?

## Motion

- Does every major interaction have meaningful feedback?
- Is there a page transition?
- Does the hero feel cinematic?
- Are scroll reveals tasteful?
- Are animations too slow?
- Is reduced motion supported?

## Commerce

- Add to cart works.
- Quantity updates correctly.
- Remove works.
- Totals recalculate.
- Checkout validation works.
- Mock payment handles processing/success/failure.
- Confirmation contains order ID.
- Tracking reflects order state.

## Accessibility

- keyboard navigation
- focus states
- labels
- semantic buttons/links
- contrast
- touch targets ≥ 44px
- reduced motion

## Performance

- no huge video on first load
- no unnecessary re-renders
- no scroll jank
- images optimized
- below-fold media lazy loaded

---

# 50. Final Acceptance Criteria

The website is ready for review only when all of the following are true:

### Brand

- unmistakably Tresor
- V2 art direction is visible
- palette is consistent
- typography feels editorial

### Motion

- polished Framer Motion throughout
- cinematic hero
- page transitions
- scroll reveals
- add-to-cart feedback
- cart reflow animation
- checkout loading
- confirmation choreography
- active tracking state
- subtle cute microinteractions

### Media

- supports generated Higgsfield video assets
- uses posters/fallbacks
- does not block performance

### UX

- complete customer journey
- semantic-style search
- cart
- checkout
- mock payment
- confirmation
- tracking
- account
- about
- contact
- external delivery links

### Quality

- responsive
- accessible
- keyboard-safe
- reduced-motion-safe
- typed
- clean components
- no placeholder copy accidentally shipped as real business data

---

# 51. Recommended Build Order

Build in this order:

```text
1. Global design tokens
2. Typography / shell
3. Header + page transition system
4. Brand loader
5. Home hero + cinematic media
6. Home editorial sections
7. Menu + semantic search
8. Product page
9. Cart
10. Checkout
11. Payment states
12. Confirmation
13. Tracking
14. About
15. Contact
16. Account
17. Mobile refinement
18. Accessibility pass
19. Performance pass
20. Final visual QA against Figma V2
```

Do not polish individual screens to perfection while the complete flow is still broken.

---

# 52. Final Creative Direction

The target feeling is:

> **A premium café's campaign film became an interactive website.**

Someone should be able to land on Tresor and immediately feel:

```text
this place has taste
↓
this feels alive
↓
I want to see the menu
↓
I want that pastry
↓
I trust the checkout
↓
I remember this website
```

Animation is not the product.

**The brand experience is the product.**

Use motion, video, Framer Motion and interactive details to make the experience feel physical, warm and memorable — while keeping the actual ordering experience fast, clear and trustworthy.

---

# 53. Implementation Note for Claude

When you encounter a design decision that is not explicitly represented in the V2 screens:

1. preserve the V2 visual language,
2. prefer the smallest addition that solves the UX problem,
3. use motion to clarify the interaction rather than decorate it,
4. favor real media over placeholder decoration once assets exist,
5. never revert to generic SaaS/ecommerce conventions just because they are faster to implement.

When a new feature is needed, ask:

> **Would this feel like Tresor, or like a template?**

If it feels like a template, redesign the interaction before implementing it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
