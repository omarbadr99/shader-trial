# Shader trials

## Trial 02 — Organic O: frosted shell, liquid blobs

`organic-o/index.html` — **open in a browser, no build, no dependencies
(WebGL2).** A frosted Y2K-plastic ring (think early-iMac polycarbonate)
with lava-lamp-style liquid blobs circulating inside it.

How it works — one full-screen fragment shader:

1. **Two materials, not one.** The shell is frosted polycarbonate with a
   real **wall thickness** dial: the liquid is confined to the tube's core,
   so the dark mass always keeps a pale frosted margin at the silhouette —
   that margin is what makes the edges read sharp. The cross-section is
   flattened (coin-like) for the molded-plastic face. Micro speckle is
   fixed in shape space so it rotates with the object.
2. **Blobs, not a wash.** Each blob is an independent liquid mass with its
   own color, angular size, speed *and direction*, comet **tail** (trails
   opposite the direction of travel), and lava-lamp **drift** (speed
   breathes, can briefly reverse). Blobs are added with a **+ Add blob**
   button (up to 6), removed per-row, and mix subtractively where they
   overlap — per-channel Beer–Lambert with each blob's own absorption.
3. **Motion rules (learned from the reference).** The tri-lobe profile is
   constant — the shape only moves rigidly: slow in-plane spin plus a
   precessing tilt driven by two sinusoids at non-matching frequencies, so
   the sway never repeats the same path. No surface noise; the optional
   "organic drift" dial adds only a very slow, low-amp radius drift. Blob
   circulation is fully independent of the geometry clocks.
4. **Robust rendering.** Bisection-refined hits (no tangent-ray glitches),
   jittered uniform sampling through the tube (no ink banding), no additive
   fresnel rims — edge definition comes from density, not glow lines.

Per-blob: color, size, speed, ink, tail, drift, follow-cursor. Global:
ink amount, spin, tilt sway/speed, organic drift, tri-lobe, thickness,
flatten, taper, zoom, frost, wall thickness, speckle, edge softness,
grain, background. Presets: **Reference / Lava / Ghost**. Drag to orbit;
a blob marked "cursor" chases the pointer while everything else keeps
moving on its own clocks.

`framer/OrganicO.tsx` is the same shader as a Framer code component —
create a code file from it (same steps as InkBleed below), drop it on the
page. Blobs are a native Framer **array control** (add/remove in the
sidebar), everything else is a slider, plus a transparent-background
option.

## Trial 01 — Ink Bleed, scroll-degraded text

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
