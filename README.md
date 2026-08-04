# Ink Bleed — scroll-degraded text

A live-text "ink bleed" effect: text dissolves into fat, distressed ink
(bleed / photocopy / smear / spray) around discrete pools, and pulls itself
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

4. **Gravity points** — ink pools around discrete centres, not along a front.
   Each centre sits in its own jittered grid cell (seeded, so it is
   repeatable and never clumps into a corner) and carries its own radius and
   weight. A point is solid at the core and falls off radially to nothing at
   its reach; overlapping points merge softly — `1 − Π(1 − cᵢ)` — so two
   neighbours pool into one larger blot instead of stamping over each other.
   Points are 1.8× wider than tall, because a round blot on a line-tall word
   reads as a stripe rather than a pool.
5. **Granularity** — each `.ink-line` is split per word or **per letter**, so
   a point's falloff resolves *inside* a word: the core glyphs drown while
   the ones at the edge of the blot are only half-eaten. Split letters are
   wrapped in a nowrap group, so lines still break at spaces only.
6. **The water line** — the field is a static map of the page; the vertical
   sweep lowers a water line across it. Cores surface first and each blot
   then grows outward from its centre, the way ink actually spreads.
   **Gravity** also sets how much authority the sweep keeps: 0 is a plain
   horizontal front, 100 leaves the water line nearly level and hands
   placement to the points. It never goes fully level — that residue is what
   resolves text as it scrolls up, and what drowns everything below the fold.

The field is sampled in **document** coordinates, so a blot belongs to the
words and stays put while you scroll: the same letters are ruined in the same
places every time, the way a real misprint would be. Page coordinates are
measured once and cached, so scrolling never re-reads layout. Splitting is
also *faster* than filtering whole lines: a filter region is proportional to
its element's bounding box, and a full-width row wastes an enormous region on
the empty gaps between columns.

## Dials

| Dial | What it does |
|---|---|
| Bleed starts at | % of viewport height where degradation begins |
| Intensity | max strength at the bottom edge |
| **Gravity** | flat horizontal front (0) ↔ placement ruled by the points (100) |
| **Point reach** | radius of one pool: tight ↔ broad |
| **Falloff** | soft haze (0) ↔ tight core with a fast edge (100) |
| **Point count** | how many grid cells actually carry ink: sparse ↔ crowded |
| Edge noise | raggedness of the ink edges |
| Fly-away spray | amount of ink droplets thrown off edges |
| Ink solidity | hard solid ink ↔ translucent wash |
| Photocopy patch | toner-starvation dropout |
| Misprint drag | vertical smear/drip |
| Per line / word / letter | granularity of the falloff — letter shades off *inside* a word |
| Hover clears | mousing over a line resolves it step by step |
| Reseed | new random ink pattern *and* new point layout |

Presets: **Pools / Tight / Broad / Xerox / Smear / Flat** (Flat = gravity off,
for comparison).

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
   **Gravity**, **Point reach**, **Falloff** and **Point count**, which
   govern where the ink pools. **Granularity** (Line / Word / Letter) sets
   how finely a pool's falloff resolves; Letter shades off inside a word,
   Line degrades a whole layer at once.

The canvas shows a static preview mapped across the component's own frame;
the real scroll behavior runs in **Preview** and on the published site.

## Other site builders

The same recipe works anywhere you can add custom HTML/JS (Webflow embed,
Squarespace code block, plain sites): copy the `<svg><defs>` + `<script>`
from `index.html`, and tag your text elements with `class="ink-line"`.
