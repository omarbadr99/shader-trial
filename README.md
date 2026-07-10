# Ink Bleed — scroll-degraded text

A live-text "ink bleed" effect: text near the bottom of the viewport dissolves
into fat, distressed ink (bleed / photocopy / smear / spray), and pulls itself
back together as you scroll it upward. Inspired by distressed print, RAY GUN
scans, and RM's INDIGO brand guidelines.

**Open `index.html` in a browser — no build, no dependencies.**

## How it works

No WebGL. The text stays real, selectable HTML — the whole effect is SVG
filters applied per line:

1. **Filter bank** — JS generates N filters of increasing strength
   (`#inkf-<size>-<level>`), rebuilt whenever a dial moves.
2. **Scroll gradient** — every `.ink-line` is assigned a level from its
   vertical position in the viewport: above the "bleed line" → no filter,
   bottom edge → max level.
3. **The ink recipe** (per filter, alpha-only so any text color survives):
   - `feMorphology` dilate → guaranteed ink gain, even on thin strokes
   - `feGaussianBlur` + lowered alpha threshold → fuzz re-solidifies as fat ink
   - `feTurbulence` + `feDisplacementMap` → organic edge wobble
   - grain subtracted from alpha pre-threshold → photocopy/toner dropout
   - displaced ink copy, eroded + re-rounded → fly-away spray droplets
   - anisotropic noise displacement + vertical drip blur → misprint drag
4. **Font-size buckets** — filters are built in S/M/L variants so the effect
   scales with the type instead of destroying small text.

## Dials

| Dial | What it does |
|---|---|
| Bleed starts at | % of viewport height where degradation begins |
| Intensity | max strength at the bottom edge |
| Randomness | noise scale — big swells vs. jitter |
| Fly-away spray | amount of ink droplets thrown off edges |
| Ink solidity | hard solid ink ↔ translucent wash |
| Photocopy patch | toner-starvation dropout |
| Misprint drag | vertical smear/drip |
| Hover clears | mousing over a line resolves it step by step |
| Reseed | new random ink pattern |

Presets: **Bleed / Xerox / Smear / Spray**.

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
4. All dials appear as native controls in the right sidebar. **Split lines**
   makes multi-line paragraphs degrade line by line.

The canvas shows a static preview mapped across the component's own frame;
the real scroll behavior runs in **Preview** and on the published site.

## Other site builders

The same recipe works anywhere you can add custom HTML/JS (Webflow embed,
Squarespace code block, plain sites): copy the `<svg><defs>` + `<script>`
from `index.html`, and tag your text elements with `class="ink-line"`.
