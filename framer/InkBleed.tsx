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

const LEVELS = 8
const BUCKETS: Record<string, number> = { S: 0.55, M: 1.0, L: 1.8 }

interface Dials {
    area: number
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

    let f = `<filter id="${uid}-${bucket}-${k}" x="-15%" width="130%" y="-180%" height="460%" color-interpolation-filters="sRGB">`

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

/* ---- split a text element into word spans so lines degrade separately -- */
function splitToWords(el: HTMLElement): HTMLElement[] {
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
            if (/^\s+$/.test(piece)) frag.appendChild(document.createTextNode(piece))
            else {
                const sp = document.createElement("span")
                sp.setAttribute("data-ink-w", "")
                sp.textContent = piece
                frag.appendChild(sp)
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
        splitLines = true,
        area = 45,
        intensity = 60,
        randomness = 45,
        spray = 45,
        solidity = 90,
        patchy = 12,
        drag = 0,
        hoverClears = true,
        seed = 7,
    } = props

    const uid = React.useMemo(
        () => "inkf" + Math.floor(Math.random() * 1e6),
        []
    )
    const rootRef = React.useRef<HTMLDivElement>(null)

    const defsHTML = React.useMemo(
        () =>
            buildFilters(uid, {
                area,
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

        /* ---- build targets (whole elements, or word spans per line) ---- */
        type Target = { el: HTMLElement; bucket: string; unit: any; lvl?: number }
        const targets: Target[] = []
        for (const u of units) {
            const fs = parseFloat(getComputedStyle(u).fontSize) || 16
            const bucket = fs < 26 ? "S" : fs <= 60 ? "M" : "L"
            let els: HTMLElement[] = [u]
            if (splitLines) {
                const words = splitToWords(u)
                const tops = new Set(
                    words.map((w) => Math.round(w.getBoundingClientRect().top / 4))
                )
                if (words.length > 1 && tops.size > 1) {
                    els = words
                } else {
                    u.innerHTML = (u as any)._inkOrig
                    ;(u as any)._inkOrig = null
                }
            }
            for (const el of els) targets.push({ el, bucket, unit: u })
        }

        /* ---- level assignment ------------------------------------------ */
        const setF = (t: Target, lvl: number) => {
            if (t.lvl === lvl) return
            t.lvl = lvl
            t.el.style.filter = lvl > 0 ? `url(#${uid}-${t.bucket}-${lvl})` : ""
        }

        const assign = () => {
            const vh = window.innerHeight
            let startY: number, span: number
            if (isCanvas) {
                // on the canvas, preview the gradient across the component frame
                const rr = root.getBoundingClientRect()
                startY = rr.top + rr.height * (area / 100)
                span = Math.max(1, rr.bottom - startY)
            } else {
                startY = vh * (area / 100)
                span = Math.max(1, vh - startY)
            }
            for (const t of targets) {
                if (t.unit._inkHover) continue
                const r = t.el.getBoundingClientRect()
                if (!isCanvas && (r.bottom < -100 || r.top > vh + 300)) {
                    setF(t, 0)
                    continue
                }
                let n = ((r.top + r.bottom) / 2 - startY) / span
                n = Math.min(1, Math.max(0, n))
                n = Math.pow(n, 1.3)
                setF(t, Math.round(n * LEVELS))
            }
        }

        assign()
        ;(document as any).fonts?.ready?.then?.(assign)

        /* ---- listeners --------------------------------------------------- */
        let raf = 0
        const onScroll = () => {
            if (raf) return
            raf = requestAnimationFrame(() => {
                raf = 0
                assign()
            })
        }
        const hoverHandlers: Array<[HTMLElement, () => void, () => void]> = []

        if (!isCanvas) {
            document.addEventListener("scroll", onScroll, {
                capture: true,
                passive: true,
            })
            window.addEventListener("resize", onScroll)

            if (hoverClears) {
                const byUnit = new Map<any, Target[]>()
                for (const t of targets) {
                    if (!byUnit.has(t.unit)) byUnit.set(t.unit, [])
                    byUnit.get(t.unit)!.push(t)
                }
                for (const [u, ts] of byUnit) {
                    const enter = () => {
                        u._inkHover = true
                        clearInterval(u._inkAnim)
                        u._inkAnim = setInterval(() => {
                            let done = true
                            for (const t of ts)
                                if ((t.lvl || 0) > 0) {
                                    setF(t, (t.lvl as number) - 1)
                                    done = false
                                }
                            if (done) clearInterval(u._inkAnim)
                        }, 30)
                    }
                    const leave = () => {
                        clearInterval(u._inkAnim)
                        u._inkHover = false
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
            window.removeEventListener("resize", onScroll)
            if (raf) cancelAnimationFrame(raf)
            for (const [u, e, l] of hoverHandlers) {
                u.removeEventListener("mouseenter", e)
                u.removeEventListener("mouseleave", l)
                clearInterval((u as any)._inkAnim)
                ;(u as any)._inkHover = false
            }
            for (const t of targets) t.el.style && (t.el.style.filter = "")
            for (const u of units)
                if ((u as any)._inkOrig != null) {
                    u.innerHTML = (u as any)._inkOrig
                    ;(u as any)._inkOrig = null
                }
        }
    }, [
        defsHTML,
        targetNames,
        splitLines,
        hoverClears,
        area,
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
    splitLines: {
        type: ControlType.Boolean,
        title: "Split lines",
        defaultValue: true,
    },
    area: {
        type: ControlType.Number,
        title: "Bleed starts",
        min: 0,
        max: 100,
        defaultValue: 45,
        unit: "%",
    },
    intensity: {
        type: ControlType.Number,
        title: "Intensity",
        min: 0,
        max: 100,
        defaultValue: 60,
    },
    randomness: {
        type: ControlType.Number,
        title: "Randomness",
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
