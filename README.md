# Ink Bleed — scroll-degraded text

A live-text "ink bleed" effect: text near the bottom of the viewport dissolves
into fat, distressed ink (bleed / photocopy / smear / spray), and pulls itself
back together as you scroll it upward. Inspired by distressed print, RAY GUN
scans, and RM's INDIGO brand guidelines.

**Open `index.html` in a browser — no build, no dependencies.**

## How it works

No WebGL. The text stays real, selectable HTML — the whole effect is SVG
filters. There are two independent halves:

**What the ink looks like**

1. **Filter bank** — JS generates N filters of increasing strength
   (`#inkf-<size>-<level>`), rebuilt whenever a dial moves.
2. **The ink recipe** (per filter, alpha-only so any text color survives):
   - `feMorphology` dilate → guaranteed ink gain, even on thin strokes
   - `feGaussianBlur` + lowered alpha threshold → fuzz re-solidifies as fat ink
   - `feTurbulence` + `feDisplacementMap` → organic edge wobble
   - grain subtracted from alpha pre-threshold → photocopy/toner dropout
   - displaced ink copy, eroded + re-rounded → fly-away spray droplets
   - anisotropic noise displacement + vertical drip blur → misprint drag
3. **Font-size buckets** — filters are built in S/M/L variants so the effect
   scales with the type instead of destroying small text.

**Where the ink lands**

4. **Per-word targets** — each `.ink-line` is split into one span per word, so
   the ink can vary *within* a line instead of hitting it all at once.
5. **Blotchy front** — a word's level is its vertical position *plus* an
   offset sampled from 2D value noise. The noise is sampled in **document**
   coordinates, not viewport ones, so a blotch belongs to the word and stays
   put while you scroll — the same words are ruined in the same places every
   time, the way a real misprint would be. Set Unevenness to 0 and it
   collapses back to a clean horizontal gradient.
6. **Gate** — the offset is faded in above the bleed line and tapered at the
   bottom edge, so the top of the screen stays clean and everything still
   drowns at the very bottom.

Page coordinates are measured once and cached, so scrolling never re-reads
layout. Splitting per word is also *faster* than filtering whole lines: a
filter region is proportional to its element's bounding box, and a full-width
row wastes an enormous region on the empty gaps between columns.

## Dials

| Dial | What it does |
|---|---|
| Bleed starts at | % of viewport height where degradation begins |
| Intensity | max strength at the bottom edge |
| **Unevenness** | how far a word may run ahead of / behind the bleed line — 0 = uniform |
| **Blotch scale** | fine speckle ↔ broad continents that swallow whole sentences |
| Edge noise | raggedness of the ink edges |
| Fly-away spray | amount of ink droplets thrown off edges |
| Ink solidity | hard solid ink ↔ translucent wash |
| Photocopy patch | toner-starvation dropout |
| Misprint drag | vertical smear/drip |
| Per word | split lines into words (off = whole line degrades together) |
| Hover clears | mousing over a line resolves it step by step |
| Reseed | new random ink pattern *and* new blotch layout |

Presets: **Bleed / Blotch / Xerox / Smear / Spray / Flat** (Flat = unevenness
off, for comparison).

## Framer

`framer/InkBleed.tsx` is a ready-made Framer code component:

1. In Framer: left sidebar → **Assets** tab → **Code** → **+** → New code
   file → replace its contents with `InkBleed.tsx` → rename it `InkBleed`.
2. Drag the component from Assets anywhere onto your page (it can stay tiny).
3. Name the text layers you want affected (double-click the layer name in the
   Layers panel, e.g. `Ink`), then type that name into the component's
   **Target names** property. Multiple names are comma-separated. Every layer
   with a matching name gets the effect — or connect layers to **Content**
   instead.
4. All dials appear as native controls in the right sidebar — including
   **Unevenness** and **Blotch scale**, which govern how randomly the ink
   lands. **Per word** splits text into words so the blotches vary within a
   line; turn it off to degrade whole layers at once.

The canvas shows a static preview mapped across the component's own frame;
the real scroll behavior runs in **Preview** and on the published site.

## Other site builders

The same recipe works anywhere you can add custom HTML/JS (Webflow embed,
Squarespace code block, plain sites): copy the `<svg><defs>` + `<script>`
from `index.html`, and tag your text elements with `class="ink-line"`.
