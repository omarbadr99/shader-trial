import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * INK BLEED — distressed-print effect for live text.
 *
 * Text near the bottom of the viewport dissolves into fat, distressed ink
 * (bleed / photocopy dropout / spray / misprint drag) and resolves as it
 * scrolls up. Pure SVG filters on the text's alpha channel — text stays
 * real and selectable, and any text color is inherited automatically.
 *
 * The bleed does not advance as a straight horizontal front. Ink pools
 * around discrete GRAVITY POINTS anchored to the PAGE: each point is solid
 * at its core and falls off radially to nothing at its reach, so a blot
 * fades through its neighbours instead of switching them on together, and
 * it stays glued to the same words as you scroll. Set "Granularity" to
 * Letter and the falloff resolves inside a single word.
 *
 * "Gravity" is the master dial — 0 is a plain horizontal front, 100 hands
 * placement entirely to the points. "Point reach", "Falloff" and "Point
 * count" shape the individual pools.
 *
 * Two ways to use it:
 *  1. "Target names": type the names of text layers on your page
 *     (comma-separated). The effect finds and drives them wherever they are.
 *  2. Connect layers to "Content" so they render inside the component.
 *
 * The canvas shows a static preview mapped across the component's own frame;
 * the real scroll behavior runs in Preview and on the published site.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 220
 * @framerIntrinsicHeight 48
 */

const LEVELS = 14
const BUCKETS: Record<string, number> = { S: 0.55, M: 1.0, L: 1.8 }

interface Dials {
    intensity: number
    randomness: number
    spray: number
    solidity: number
    patchy: number
    drag: number
    seed: number
}

/* ---- one filter for a size bucket + strength level --------------------- */
function filterXML(uid: string, P: Dials, bucket: string, k: number): string {
    const sf = BUCKETS[bucket]
    const t = k / LEVELS
    const s = t * (P.intensity / 100)
    const sd = P.seed
    const sol = P.solidity / 100

    // bleed: dilate guarantees ink gain even on thin strokes, then blur +
    // a lowered alpha threshold re-solidifies the fuzz as fat ink
    const dil = ((0.2 + 1.6 * s) * sf).toFixed(2)
    const blur = ((0.3 + 3.0 * s) * sf).toFixed(2)
    const thr = Math.max(0.08, 0.5 - 0.34 * s)
    const slope = (4 + 14 * sol).toFixed(1)
    const icpt = (-parseFloat(slope) * thr).toFixed(3)

    // organic edge wobble
    const wf = ((0.008 + (P.randomness / 100) * 0.05) / sf).toFixed(4)
    const wob = ((1.2 + 7 * s) * sf).toFixed(1)

    // photocopy dropout
    const patchAmt = ((P.patchy / 100) * (0.35 + 0.85 * s)).toFixed(3)
    const grainF = (0.1 / Math.sqrt(sf)).toFixed(3)

    // fly-away spray
    const dotAmt = (P.spray / 100) * s
    const sprayScl = ((5 + 42 * dotAmt) * sf).toFixed(1)
    const sprayF = (0.3 / sf).toFixed(3)

    // misprint drag
    const dragScl = ((P.drag / 100) * 55 * s * sf).toFixed(1)
    const dripBlur = ((P.drag / 100) * 9 * s * sf).toFixed(2)

    // filter region: targets are often single short words, and spray and drag
    // both throw ink well outside the glyph box — but the region is the single
    // biggest cost driver (every primitive runs over every pixel of it), so it
    // grows only as far as the enabled effects actually reach
    const mv = Math.round(55 + (P.spray / 100) * 145 + (P.drag / 100) * 190)
    const mh = Math.round(20 + (P.spray / 100) * 48)

    let f = `<filter id="${uid}-${bucket}-${k}" x="-${mh}%" width="${mh * 2 + 100}%" y="-${mv}%" height="${mv * 2 + 100}%" color-interpolation-filters="sRGB">`

    let base = "SourceGraphic"
    if (P.drag > 0) {
        f += `<feTurbulence type="fractalNoise" baseFrequency="${(0.045 / sf).toFixed(3)} 0.003" numOctaves="2" seed="${sd}" result="dragN"/>
        <feColorMatrix in="dragN" type="matrix" values="0 0 0 0 0.5  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dragN2"/>
        <feDisplacementMap in="SourceGraphic" in2="dragN2" scale="${dragScl}" xChannelSelector="R" yChannelSelector="G" result="dragged0"/>
        <feGaussianBlur in="dragged0" stdDeviation="0 ${dripBlur}" result="dragged"/>`
        base = "dragged"
    }

    f += `<feMorphology in="${base}" operator="dilate" radius="${dil}" result="fat"/>
    <feGaussianBlur in="fat" stdDeviation="${blur}" result="blurred"/>
    <feTurbulence type="fractalNoise" baseFrequency="${wf}" numOctaves="2" seed="${sd + 1}" result="wobN"/>
    <feDisplacementMap in="blurred" in2="wobN" scale="${wob}" xChannelSelector="R" yChannelSelector="G" result="warped"/>`

    let preThr = "warped"
    if (P.patchy > 0) {
        f += `<feTurbulence type="fractalNoise" baseFrequency="${grainF}" numOctaves="2" seed="${sd + 2}" result="grainN"/>
        <feColorMatrix in="grainN" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 -0.15" result="grainA"/>
        <feComposite in="warped" in2="grainA" operator="arithmetic" k1="0" k2="1" k3="-${patchAmt}" k4="0" result="eroded"/>`
        preThr = "eroded"
    }

    f += `<feComponentTransfer in="${preThr}" result="ink">
      <feFuncA type="linear" slope="${slope}" intercept="${icpt}"/>
    </feComponentTransfer>`

    let out = "ink"
    if (dotAmt > 0.01) {
        f += `<feTurbulence type="turbulence" baseFrequency="${sprayF}" numOctaves="1" seed="${sd + 3}" result="sprayN"/>
        <feDisplacementMap in="ink" in2="sprayN" scale="${sprayScl}" xChannelSelector="R" yChannelSelector="G" result="spray0"/>
        <feTurbulence type="fractalNoise" baseFrequency="${(0.14 / sf).toFixed(3)}" numOctaves="2" seed="${sd + 4}" result="sgN"/>
        <feColorMatrix in="sgN" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 -0.25" result="sgA"/>
        <feComposite in="spray0" in2="sgA" operator="arithmetic" k1="1.8" k2="0" k3="0" k4="0" result="sprayE"/>
        <feGaussianBlur in="sprayE" stdDeviation="${(0.5 * sf).toFixed(2)}" result="sprayB"/>
        <feComponentTransfer in="sprayB" result="spray">
          <feFuncA type="linear" slope="10" intercept="-2.2"/>
        </feComponentTransfer>
        <feMerge result="merged"><feMergeNode in="spray"/><feMergeNode in="ink"/></feMerge>`
        out = "merged"
    }

    if (sol < 0.999) {
        f += `<feComponentTransfer in="${out}">
          <feFuncA type="linear" slope="${(0.35 + 0.65 * sol).toFixed(3)}" intercept="0"/>
        </feComponentTransfer>`
    }

    return f + `</filter>`
}

function buildFilters(uid: string, P: Dials): string {
    let xml = ""
    for (const b of Object.keys(BUCKETS))
        for (let k = 1; k <= LEVELS; k++) xml += filterXML(uid, P, b, k)
    return xml
}

/* ---- deterministic per-cell hash, sampled in PAGE coordinates ---------- */
function hash2(ix: number, iy: number, seed: number): number {
    let n =
        Math.imul(ix | 0, 374761393) +
        Math.imul(iy | 0, 668265263) +
        Math.imul(seed | 0, 362437)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/* ---- the gravity-point field -------------------------------------------
   Ink pools around discrete centres rather than advancing as a front. Each
   centre sits in its own jittered grid cell, so the points are seeded,
   repeatable and never clump into one corner; each carries its own radius
   and weight. A point is 1 at the core and falls off radially to 0 at its
   reach, and overlapping points merge softly (1 − Π(1 − cᵢ)) instead of
   stamping over one another, so two neighbours pool into one larger blot
   the way wet ink would.

   Points are wider than they are tall — text runs horizontally, and a round
   blot on a line-tall word reads as a stripe rather than a pool.          */
const ASPECT = 1.8

function blobDensity(
    x: number,
    y: number,
    size: number,
    falloff: number,
    density: number,
    seed: number
): number {
    const R = 34 + Math.pow(size / 100, 1.7) * 560 // reach in px
    const gap = R * 1.05 // grid pitch
    const exp = 0.55 + Math.pow(falloff / 100, 1.3) * 4.2
    const keep = density / 100
    const gapX = gap * ASPECT

    const gx = Math.floor(x / gapX),
        gy = Math.floor(y / gap)
    let miss = 1

    for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
            const cx = gx + ox,
                cy = gy + oy
            if (hash2(cx, cy, seed) > keep) continue // cell carries no ink
            const h2 = hash2(cx, cy, seed + 17)
            const h3 = hash2(cx, cy, seed + 43)
            const h4 = hash2(cx, cy, seed + 71)

            const px = (cx + 0.12 + 0.76 * h2) * gapX // jittered in-cell
            const py = (cy + 0.12 + 0.76 * h3) * gap
            const r = R * (0.6 + 0.8 * h4) // every point a different size
            const w = 0.66 + 0.34 * h2 //     and a different weight

            const dx = (x - px) / (r * ASPECT),
                dy = (y - py) / r
            const d2 = dx * dx + dy * dy
            if (d2 >= 1) continue
            miss *= 1 - w * Math.pow(1 - d2, exp)
        }
    }
    return 1 - miss
}

/* ---- split a text element into per-word or per-letter spans ------------
   Letters are wrapped in a nowrap group so the browser still only breaks
   lines at spaces, never between two inline-block glyphs.                */
function splitToUnits(el: HTMLElement, mode: string): HTMLElement[] {
    const anyEl = el as any
    if (anyEl._inkOrig == null) anyEl._inkOrig = el.innerHTML
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) {
        const n = walker.currentNode as Text
        if (n.nodeValue && n.nodeValue.trim()) textNodes.push(n)
    }
    for (const node of textNodes) {
        const frag = document.createDocumentFragment()
        for (const piece of (node.nodeValue || "").split(/(\s+)/)) {
            if (!piece) continue
            if (/^\s+$/.test(piece)) {
                frag.appendChild(document.createTextNode(piece))
                continue
            }
            if (mode === "word") {
                const sp = document.createElement("span")
                sp.setAttribute("data-ink-w", "")
                sp.style.display = "inline-block"
                sp.textContent = piece
                frag.appendChild(sp)
            } else {
                const g = document.createElement("span")
                g.style.display = "inline-block"
                g.style.whiteSpace = "nowrap"
                for (const ch of Array.from(piece)) {
                    const sp = document.createElement("span")
                    sp.setAttribute("data-ink-w", "")
                    sp.style.display = "inline-block"
                    sp.textContent = ch
                    g.appendChild(sp)
                }
                frag.appendChild(g)
            }
        }
        node.parentNode?.replaceChild(frag, node)
    }
    return Array.from(el.querySelectorAll<HTMLElement>("[data-ink-w]"))
}

const TEXT_SEL = "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,a,button"

export default function InkBleed(props: any) {
    const {
        content,
        targetNames = "",
        unit = "letter",
        area = 30,
        intensity = 60,
        gravity = 75,
        size = 40,
        falloff = 32,
        density = 62,
        randomness = 45,
        spray = 45,
        solidity = 90,
        patchy = 12,
        drag = 0,
        hoverClears = true,
        seed = 7,
    } = props

    const uid = React.useMemo(() => "inkf" + Math.floor(Math.random() * 1e6), [])
    const rootRef = React.useRef<HTMLDivElement>(null)

    const defsHTML = React.useMemo(
        () =>
            buildFilters(uid, {
                intensity,
                randomness,
                spray,
                solidity,
                patchy,
                drag,
                seed,
            }),
        [uid, intensity, randomness, spray, solidity, patchy, drag, seed]
    )

    React.useEffect(() => {
        const root = rootRef.current
        if (!root || typeof window === "undefined") return

        const isCanvas = RenderTarget.current() === RenderTarget.canvas

        /* ---- gather the text elements to drive ------------------------- */
        const scopes: Element[] = [root]
        const names = String(targetNames)
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        for (const n of names)
            document
                .querySelectorAll(`[data-framer-name="${CSS.escape(n)}"]`)
                .forEach((el) => scopes.push(el))

        const unitSet = new Set<HTMLElement>()
        for (const scope of scopes) {
            if ((scope as HTMLElement).matches?.(TEXT_SEL))
                unitSet.add(scope as HTMLElement)
            scope.querySelectorAll<HTMLElement>(TEXT_SEL).forEach((el) => {
                if (el.textContent && el.textContent.trim()) unitSet.add(el)
            })
        }
        const all = Array.from(unitSet)
        const units = all.filter(
            (u) => !all.some((o) => o !== u && o.contains(u))
        )

        /* ---- build targets: whole elements, or one per word ------------- */
        type Target = {
            el: HTMLElement
            bucket: string
            unit: any
            lvl?: number
            pyTop: number
            pyBot: number
            pcx: number
            pcy: number
        }
        const targets: Target[] = []
        const unitTargets = new Map<HTMLElement, Target[]>()

        for (const u of units) {
            let els: HTMLElement[] = [u]
            if (unit !== "line") {
                const words = splitToUnits(u, unit)
                if (words.length > 1) els = words
                else {
                    u.innerHTML = (u as any)._inkOrig
                    ;(u as any)._inkOrig = null
                }
            }
            const list: Target[] = []
            for (const el of els) {
                const fs = parseFloat(getComputedStyle(el).fontSize) || 16
                const t: Target = {
                    el,
                    bucket: fs < 26 ? "S" : fs <= 60 ? "M" : "L",
                    unit: u,
                    pyTop: 0,
                    pyBot: 0,
                    pcx: 0,
                    pcy: 0,
                }
                targets.push(t)
                list.push(t)
            }
            unitTargets.set(u, list)
            ;(u as any)._inkTargets = list
        }

        /* ---- cache page coordinates: scrolling never re-reads layout ---- */
        const measure = () => {
            const sy = window.scrollY,
                sx = window.scrollX
            for (const t of targets) {
                const r = t.el.getBoundingClientRect()
                t.pyTop = r.top + sy
                t.pyBot = r.bottom + sy
                t.pcx = r.left + r.width / 2 + sx
                t.pcy = r.top + r.height / 2 + sy
            }
        }

        const setF = (t: Target, lvl: number) => {
            if (t.lvl === lvl) return
            t.lvl = lvl
            t.el.style.filter = lvl > 0 ? `url(#${uid}-${t.bucket}-${lvl})` : ""
        }

        const assign = () => {
            const vh = window.innerHeight
            const sy = window.scrollY
            let startY: number, span: number, originY: number
            if (isCanvas) {
                // on the canvas, preview the gradient across the component frame
                const rr = root.getBoundingClientRect()
                originY = rr.top + sy
                startY = rr.height * (area / 100)
                span = Math.max(1, rr.height - startY)
            } else {
                originY = sy
                startY = vh * (area / 100)
                span = Math.max(1, vh - startY)
            }
            for (const t of targets) {
                if (t.unit._inkHover) continue
                const top = t.pyTop - originY,
                    bot = t.pyBot - originY
                if (!isCanvas && (bot < -140 || top > vh + 340)) {
                    setF(t, 0)
                    continue
                }
                const raw = ((top + bot) / 2 - startY) / span

                // The field is a static map of the page; the sweep lowers a
                // water line across it. Cores surface first and each blot then
                // grows outward from its own centre, so a word's neighbours
                // shade off gradually instead of switching on together.
                //
                // Gravity also decides how much authority the sweep keeps: at
                // 0 the map is flat and this is a plain horizontal front, at
                // 100 the water line is nearly level and placement belongs to
                // the points alone. It never goes fully level — the residue is
                // what resolves text as it scrolls up, and what drowns
                // everything below the fold.
                const g = gravity / 100
                const d =
                    g *
                        blobDensity(t.pcx, t.pcy, size, falloff, density, seed) +
                    (1 - g) * 0.55
                const water =
                    0.62 - 0.98 * (1 - 0.62 * g) * Math.min(raw, 2.2)

                setF(t, Math.round(clamp01((d - water) / 0.5) * LEVELS))
            }
        }

        measure()
        assign()
        ;(document as any).fonts?.ready?.then?.(() => {
            measure()
            assign()
        })

        /* ---- listeners --------------------------------------------------- */
        let raf = 0
        const onScroll = () => {
            if (raf) return
            raf = requestAnimationFrame(() => {
                raf = 0
                assign()
            })
        }
        const onResize = () => {
            measure()
            onScroll()
        }
        const hoverHandlers: Array<[HTMLElement, () => void, () => void]> = []

        if (!isCanvas) {
            document.addEventListener("scroll", onScroll, {
                capture: true,
                passive: true,
            })
            window.addEventListener("resize", onResize)

            if (hoverClears) {
                for (const [u, ts] of unitTargets) {
                    const enter = () => {
                        ;(u as any)._inkHover = true
                        clearInterval((u as any)._inkAnim)
                        ;(u as any)._inkAnim = setInterval(() => {
                            let done = true
                            for (const t of ts)
                                if ((t.lvl || 0) > 0) {
                                    setF(t, (t.lvl as number) - 1)
                                    done = false
                                }
                            if (done) clearInterval((u as any)._inkAnim)
                        }, 30)
                    }
                    const leave = () => {
                        clearInterval((u as any)._inkAnim)
                        ;(u as any)._inkHover = false
                        onScroll()
                    }
                    u.addEventListener("mouseenter", enter)
                    u.addEventListener("mouseleave", leave)
                    hoverHandlers.push([u, enter, leave])
                }
            }
        }

        /* ---- cleanup ------------------------------------------------------ */
        return () => {
            document.removeEventListener("scroll", onScroll, true)
            window.removeEventListener("resize", onResize)
            if (raf) cancelAnimationFrame(raf)
            for (const [u, e, l] of hoverHandlers) {
                u.removeEventListener("mouseenter", e)
                u.removeEventListener("mouseleave", l)
                clearInterval((u as any)._inkAnim)
                ;(u as any)._inkHover = false
            }
            for (const t of targets) if (t.el.style) t.el.style.filter = ""
            for (const u of units)
                if ((u as any)._inkOrig != null) {
                    u.innerHTML = (u as any)._inkOrig
                    ;(u as any)._inkOrig = null
                }
        }
    }, [
        defsHTML,
        targetNames,
        unit,
        hoverClears,
        area,
        gravity,
        size,
        falloff,
        density,
        seed,
    ])

    const isEmpty = !content || (Array.isArray(content) && content.length === 0)
    const onCanvas = RenderTarget.current() === RenderTarget.canvas

    return (
        <div
            ref={rootRef}
            style={{ position: "relative", width: "100%", height: "100%" }}
        >
            <svg
                width="0"
                height="0"
                style={{ position: "absolute" }}
                aria-hidden="true"
            >
                <defs dangerouslySetInnerHTML={{ __html: defsHTML }} />
            </svg>
            {content}
            {isEmpty && onCanvas && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        border: "1.5px dashed currentColor",
                        opacity: 0.75,
                        padding: 8,
                        textAlign: "center",
                    }}
                >
                    {targetNames
                        ? `INK BLEED → ${targetNames}`
                        : "INK BLEED — set Target names or connect Content"}
                </div>
            )}
        </div>
    )
}

addPropertyControls(InkBleed, {
    targetNames: {
        type: ControlType.String,
        title: "Target names",
        placeholder: "Ink, Row, Bio",
        defaultValue: "",
    },
    content: {
        type: ControlType.Array,
        title: "Content",
        control: { type: ControlType.ComponentInstance },
    },
    unit: {
        type: ControlType.Enum,
        title: "Granularity",
        options: ["line", "word", "letter"],
        optionTitles: ["Line", "Word", "Letter"],
        defaultValue: "letter",
    },
    area: {
        type: ControlType.Number,
        title: "Bleed starts",
        min: 0,
        max: 100,
        defaultValue: 30,
        unit: "%",
    },
    intensity: {
        type: ControlType.Number,
        title: "Intensity",
        min: 0,
        max: 100,
        defaultValue: 60,
    },
    gravity: {
        type: ControlType.Number,
        title: "Gravity",
        min: 0,
        max: 100,
        defaultValue: 75,
    },
    size: {
        type: ControlType.Number,
        title: "Point reach",
        min: 0,
        max: 100,
        defaultValue: 40,
    },
    falloff: {
        type: ControlType.Number,
        title: "Falloff",
        min: 0,
        max: 100,
        defaultValue: 32,
    },
    density: {
        type: ControlType.Number,
        title: "Point count",
        min: 0,
        max: 100,
        defaultValue: 62,
    },
    randomness: {
        type: ControlType.Number,
        title: "Edge noise",
        min: 0,
        max: 100,
        defaultValue: 45,
    },
    spray: {
        type: ControlType.Number,
        title: "Fly-away spray",
        min: 0,
        max: 100,
        defaultValue: 45,
    },
    solidity: {
        type: ControlType.Number,
        title: "Ink solidity",
        min: 0,
        max: 100,
        defaultValue: 90,
    },
    patchy: {
        type: ControlType.Number,
        title: "Photocopy patch",
        min: 0,
        max: 100,
        defaultValue: 12,
    },
    drag: {
        type: ControlType.Number,
        title: "Misprint drag",
        min: 0,
        max: 100,
        defaultValue: 0,
    },
    hoverClears: {
        type: ControlType.Boolean,
        title: "Hover clears",
        defaultValue: true,
    },
    seed: {
        type: ControlType.Number,
        title: "Seed",
        min: 1,
        max: 500,
        step: 1,
        defaultValue: 7,
        displayStepper: true,
    },
})
