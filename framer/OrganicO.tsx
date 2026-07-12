import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * Organic O — frosted shell, liquid blobs (WebGL2 raymarching shader)
 *
 * A frosted Y2K-plastic ring (real wall thickness) with lava-lamp-style
 * liquid blobs circulating inside. Blobs are a native Framer array control:
 * add as many as you like (up to 6), each with its own color, size, speed,
 * direction, tail and drift. Geometry moves rigidly — spin + precessing
 * tilt — never surface noise.
 * Same shader as organic-o/index.html in the shader-trial repo.
 */

const MAXB = 6

const VERT = `#version 300 es
void main(){
  vec2 v = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  gl_Position = vec4(v*2.0-1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
out vec4 O;

#define MAXB ${MAXB}
#define PI  3.14159265
#define TAU 6.28318531

uniform vec2  uRes;
uniform float uYaw, uPitch;
uniform float uSpinPhase;
uniform float uOrgPhase;
uniform float uZoom;
uniform float uTube;
uniform float uFlat;
uniform float uTaper;
uniform float uLobe;
uniform float uOrganic;
uniform float uInk;
uniform float uFrost;
uniform float uWall;
uniform float uSpeckle;
uniform float uGrain;
uniform vec3  uBg;
uniform float uSoft;
uniform float uJitter;
uniform float uTransparent;
uniform int   uBlobN;
uniform vec4  uBlobA[MAXB];
uniform vec3  uBlobAbs[MAXB];

float ringR(float ths){
  return 1.0
    + uLobe * cos(3.0*ths + 0.9)
    + uOrganic * (0.05*cos(2.0*ths - uOrgPhase) + 0.03*sin(4.0*ths + 0.7*uOrgPhase));
}
float tubeR(float ths){
  return uTube * (1.0 + uTaper * cos(2.0*ths + 0.4));
}

float map(vec3 p){
  float th  = atan(p.y, p.x);
  float ths = th - uSpinPhase;
  vec2 q = vec2(length(p.xy) - ringR(ths), p.z/uFlat);
  return (length(q) - tubeR(ths)) * 0.62 * uFlat;
}

vec3 calcNormal(vec3 p){
  const vec2 e = vec2(0.0018, -0.0018);
  return normalize(
    e.xyy*map(p+e.xyy) + e.yyx*map(p+e.yyx) +
    e.yxy*map(p+e.yxy) + e.xxx*map(p+e.xxx));
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(17.1,31.7,7.13)))*43758.5453); }

vec3 inkOD(vec3 p, out float coreW){
  float th  = atan(p.y, p.x);
  float ths = th - uSpinPhase;
  vec2 q = vec2(length(p.xy) - ringR(ths), p.z/uFlat);
  float qn = length(q) / tubeR(ths);
  float core = 1.0 - uWall;
  coreW = smoothstep(core, core - 0.35, qn);

  vec3 od = vec3(0.0);
  for (int i=0; i<MAXB; i++){
    if (i >= uBlobN) break;
    vec4 B = uBlobA[i];
    float d = mod(th - B.x + PI, TAU) - PI;
    float w = B.y * (d*B.z > 0.0 ? 1.0 + 2.2*abs(B.z) : 1.0);
    float g = exp(-0.5*d*d/(w*w));
    g *= 1.0 - smoothstep(0.7*PI, PI, abs(d));
    od += uBlobAbs[i] * (B.w * g);
  }
  return od * coreW;
}

mat3 orbit(float yaw, float pitch){
  float cy=cos(yaw), sy=sin(yaw), cp=cos(pitch), sp=sin(pitch);
  mat3 ry = mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
  mat3 rx = mat3(1.,0.,0., 0.,cp,sp, 0.,-sp,cp);
  return ry*rx;
}
vec2 rot2(vec2 v, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*v; }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);

  mat3 M = orbit(uYaw, uPitch);
  float camD = 8.0/uZoom;
  vec3 ro = M * vec3(0.0, 0.0, camD);
  vec3 rd = M * normalize(vec3(uv*0.62, -1.0));

  float t = max(0.0, camD - 2.6);
  float tPrev = t;
  float minD = 1e9, tAt = t;
  bool hit = false;
  for (int i=0; i<140; i++){
    vec3 p = ro + rd*t;
    float d = map(p);
    if (d < minD){ minD = d; tAt = t; }
    if (d < 0.001){
      float a = tPrev, b = t;
      for (int j=0; j<5; j++){
        float m = 0.5*(a+b);
        if (map(ro + rd*m) < 0.0005) b = m; else a = m;
      }
      t = b; hit = true; break;
    }
    tPrev = t;
    t += d;
    if (t > camD + 2.6) break;
  }

  float vig = length(uv)*0.5;
  vec3 bg = uBg * (1.0 - 0.04*vig*vig) * (1.0 + 0.008*uv.y);
  bg *= 1.0 - 0.03 * exp(-max(minD, 0.0)*2.2);

  float wpp = tAt * 1.24 / min(uRes.x, uRes.y);
  float aa  = uSoft * wpp;
  float alpha = hit ? 1.0 : clamp(1.0 - minD/aa, 0.0, 1.0);

  vec3 col = bg;
  if (alpha > 0.0){
    float t0 = hit ? t : tAt;
    vec3 p = ro + rd*t0;
    vec3 n = calcNormal(p);

    float tExit = t0 + 0.004;
    for (int i=0; i<48; i++){
      float d = map(ro + rd*tExit);
      if (d > 0.0015) break;
      tExit += max(-d/(0.62*uFlat), 0.012);
    }
    float L = tExit - t0;
    vec3 od = vec3(0.0);
    float shellT = 0.0;
    {
      const int NS = 22;
      float st = L/float(NS);
      float j = hash(gl_FragCoord.xy + vec2(uJitter, uJitter*1.7));
      for (int i=0; i<NS; i++){
        vec3 q = ro + rd*(t0 + (float(i)+j)*st);
        float coreW;
        od += inkOD(q, coreW);
        shellT += 1.0 - coreW;
      }
      od *= st;
      shellT *= st;
    }

    vec3 inkT = exp(-od * uInk);
    float milk = 1.0 - exp(-(L*uFrost*1.6 + shellT*uFrost*3.0));
    vec3 milkCol = vec3(0.962, 0.973, 0.985);

    vec3 ps = vec3(rot2(p.xy, -uSpinPhase), p.z);
    float spk = (hash3(floor(ps*140.0)) - 0.5) * 0.055
              + (hash3(floor(ps*47.0) + 7.0) - 0.5) * 0.03;

    vec3 body = mix(bg * inkT, milkCol * exp(-od * uInk * 0.72), milk);
    body *= 1.0 + spk * uSpeckle * milk;

    float sheen = 0.5 + 0.5*n.y;
    body *= 0.952 + 0.058*sheen;
    vec3 ld = normalize(vec3(-0.35, 0.9, 0.6));
    body += pow(max(dot(reflect(rd, n), ld), 0.0), 90.0) * 0.05;

    col = mix(bg, body, alpha);
  }

  float g = hash(gl_FragCoord.xy) - 0.5;
  col += g * uGrain * (0.35 + 0.65*alpha);

  float outA = mix(1.0, alpha, uTransparent);
  O = vec4(col * outA, outA);
}`

const UNIFORMS = [
    "uRes", "uYaw", "uPitch", "uSpinPhase", "uOrgPhase", "uZoom", "uTube",
    "uFlat", "uTaper", "uLobe", "uOrganic", "uInk", "uFrost", "uWall",
    "uSpeckle", "uGrain", "uBg", "uSoft", "uJitter", "uTransparent",
    "uBlobN", "uBlobA", "uBlobAbs",
]

function parseColor(c: string): [number, number, number] {
    if (!c) return [0.09, 0.11, 0.2]
    if (c.startsWith("#")) {
        let h = c.slice(1)
        if (h.length === 3)
            h = h.split("").map((x) => x + x).join("")
        return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
            number, number, number,
        ]
    }
    const m = c.match(/[\d.]+/g)
    if (m && m.length >= 3)
        return [+m[0] / 255, +m[1] / 255, +m[2] / 255]
    return [0.09, 0.11, 0.2]
}
function absorb(c: string): [number, number, number] {
    return parseColor(c).map((v) =>
        -Math.log(Math.min(1, Math.max(0.02, v)))
    ) as [number, number, number]
}

interface Blob {
    color: string
    size: number
    speed: number
    ink: number
    tail: number
    drift: number
    follow: boolean
}

interface Props {
    blobs: Blob[]
    inkAmount: number
    spin: number
    tiltSway: number
    tiltSpeed: number
    organicDrift: number
    triLobe: number
    thickness: number
    flatten: number
    taper: number
    zoom: number
    frost: number
    wallThickness: number
    speckle: number
    softness: number
    grain: number
    background: string
    transparent: boolean
}

export default function OrganicO(props: Props) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const propsRef = React.useRef(props)
    propsRef.current = props

    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const gl = canvas.getContext("webgl2", {
            antialias: false,
            alpha: true,
            premultipliedAlpha: true,
        })
        if (!gl) return

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type)!
            gl.shaderSource(s, src)
            gl.compileShader(s)
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(s) || "shader error")
            return s
        }
        const prog = gl.createProgram()!
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        gl.useProgram(prog)
        const U: Record<string, WebGLUniformLocation | null> = {}
        UNIFORMS.forEach((n) => (U[n] = gl.getUniformLocation(prog, n)))

        /* per-blob angle state lives here, keyed by index */
        const angles: number[] = []
        const dPh: number[] = []
        const dFq: number[] = []
        const ph = { t: 2.5, spin: 0.3, org: 5 }
        const cursor = { angle: 0, has: false }
        let last = performance.now()
        let raf = 0
        let disposed = false
        let frameN = 0

        const onMove = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect()
            const cx = e.clientX - (r.left + r.width / 2)
            const cy = r.top + r.height / 2 - e.clientY
            cursor.angle = Math.atan2(cy, cx)
            cursor.has = true
        }
        window.addEventListener("pointermove", onMove)

        const shortestArc = (a: number, b: number) => {
            let d = (b - a) % (Math.PI * 2)
            if (d > Math.PI) d -= Math.PI * 2
            if (d < -Math.PI) d += Math.PI * 2
            return d
        }

        const blobA = new Float32Array(MAXB * 4)
        const blobAbs = new Float32Array(MAXB * 3)

        const draw = (now: number) => {
            if (disposed) return
            const P = propsRef.current
            const blobs = P.blobs || []
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now
            frameN++

            while (angles.length < blobs.length) {
                const i = angles.length
                angles.push((i * 2.4 + 1.3) % (Math.PI * 2))
                dPh.push(i * 1.7)
                dFq.push(0.35 + 0.13 * i)
            }

            if (!isCanvas) {
                ph.t += dt
                ph.spin += dt * P.spin * 0.35
                ph.org += dt * 0.5
                for (let i = 0; i < blobs.length; i++) {
                    const b = blobs[i]
                    if (b.follow && cursor.has) {
                        angles[i] +=
                            shortestArc(angles[i], cursor.angle) *
                            Math.min(1, dt * 4)
                    } else {
                        const mod =
                            1 + b.drift * Math.sin(ph.t * dFq[i] + dPh[i])
                        angles[i] += dt * b.speed * mod
                    }
                }
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w
                canvas.height = h
                gl.viewport(0, 0, w, h)
            }

            const tiltYaw =
                P.tiltSway * 0.55 * Math.sin(ph.t * 0.31 * P.tiltSpeed)
            const tiltPitch =
                P.tiltSway * 0.42 * Math.sin(ph.t * 0.203 * P.tiltSpeed + 1.3)
            const breathe = 1 + 0.015 * Math.sin(ph.t * 0.19)

            const n = Math.min(blobs.length, MAXB)
            for (let i = 0; i < n; i++) {
                const b = blobs[i]
                blobA[i * 4] = angles[i]
                blobA[i * 4 + 1] = b.size
                blobA[i * 4 + 2] =
                    b.tail * (b.speed >= 0 ? -1 : 1) * (b.follow ? 0.3 : 1)
                blobA[i * 4 + 3] = b.ink
                const A = absorb(b.color)
                blobAbs[i * 3] = A[0]
                blobAbs[i * 3 + 1] = A[1]
                blobAbs[i * 3 + 2] = A[2]
            }

            gl.uniform2f(U.uRes, w, h)
            gl.uniform1f(U.uYaw, tiltYaw)
            gl.uniform1f(U.uPitch, tiltPitch)
            gl.uniform1f(U.uSpinPhase, ph.spin)
            gl.uniform1f(U.uOrgPhase, ph.org)
            gl.uniform1f(U.uZoom, P.zoom * breathe)
            gl.uniform1f(U.uTube, P.thickness)
            gl.uniform1f(U.uFlat, P.flatten)
            gl.uniform1f(U.uTaper, P.taper)
            gl.uniform1f(U.uLobe, P.triLobe)
            gl.uniform1f(U.uOrganic, P.organicDrift)
            gl.uniform1f(U.uInk, P.inkAmount * 8)
            gl.uniform1f(U.uFrost, P.frost * 2)
            gl.uniform1f(U.uWall, P.wallThickness)
            gl.uniform1f(U.uSpeckle, P.speckle)
            gl.uniform1f(U.uGrain, P.grain)
            gl.uniform3fv(U.uBg, parseColor(P.background))
            gl.uniform1f(U.uSoft, P.softness)
            gl.uniform1f(U.uJitter, (frameN % 64) * 0.618)
            gl.uniform1f(U.uTransparent, P.transparent ? 1 : 0)
            gl.uniform1i(U.uBlobN, n)
            gl.uniform4fv(U.uBlobA, blobA)
            gl.uniform3fv(U.uBlobAbs, blobAbs)

            gl.drawArrays(gl.TRIANGLES, 0, 3)
            if (!isCanvas) raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)

        return () => {
            disposed = true
            cancelAnimationFrame(raf)
            window.removeEventListener("pointermove", onMove)
            gl.getExtension("WEBGL_lose_context")?.loseContext()
        }
    }, [isCanvas])

    return (
        <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
        />
    )
}

OrganicO.defaultProps = {
    blobs: [
        { color: "#101C33", size: 0.55, speed: 0.32, ink: 1, tail: 0.6, drift: 0.45, follow: false },
        { color: "#33507A", size: 0.85, speed: -0.15, ink: 0.4, tail: 0.5, drift: 0.7, follow: false },
    ],
    inkAmount: 0.75,
    spin: 0.2,
    tiltSway: 0.5,
    tiltSpeed: 1,
    organicDrift: 0.25,
    triLobe: 0.13,
    thickness: 0.3,
    flatten: 0.72,
    taper: 0.15,
    zoom: 1,
    frost: 0.8,
    wallThickness: 0.22,
    speckle: 0.5,
    softness: 1.4,
    grain: 0.035,
    background: "#F0F0F0",
    transparent: false,
}

addPropertyControls(OrganicO, {
    blobs: {
        type: ControlType.Array,
        title: "Blobs",
        maxCount: MAXB,
        control: {
            type: ControlType.Object,
            controls: {
                color: { type: ControlType.Color, defaultValue: "#16233F" },
                size: { type: ControlType.Number, min: 0.15, max: 1.4, step: 0.01, defaultValue: 0.5 },
                speed: { type: ControlType.Number, min: -1, max: 1, step: 0.01, defaultValue: 0.3 },
                ink: { type: ControlType.Number, min: 0, max: 1.5, step: 0.01, defaultValue: 0.9 },
                tail: { type: ControlType.Number, min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
                drift: { type: ControlType.Number, min: 0, max: 1.2, step: 0.01, defaultValue: 0.5 },
                follow: { type: ControlType.Boolean, title: "Cursor", defaultValue: false },
            },
        },
        defaultValue: [
            { color: "#101C33", size: 0.55, speed: 0.32, ink: 1, tail: 0.6, drift: 0.45, follow: false },
            { color: "#33507A", size: 0.85, speed: -0.15, ink: 0.4, tail: 0.5, drift: 0.7, follow: false },
        ],
    },
    inkAmount: { type: ControlType.Number, title: "Ink amount", min: 0, max: 1, step: 0.01 },
    spin: { type: ControlType.Number, title: "Spin", min: -1, max: 1, step: 0.01 },
    tiltSway: { type: ControlType.Number, title: "Tilt sway", min: 0, max: 1, step: 0.01 },
    tiltSpeed: { type: ControlType.Number, title: "Tilt speed", min: 0, max: 2, step: 0.01 },
    organicDrift: { type: ControlType.Number, title: "Organic drift", min: 0, max: 1, step: 0.01 },
    triLobe: { type: ControlType.Number, title: "Tri-lobe", min: 0, max: 0.25, step: 0.005 },
    thickness: { type: ControlType.Number, title: "Thickness", min: 0.12, max: 0.45, step: 0.005 },
    flatten: { type: ControlType.Number, title: "Flatten", min: 0.5, max: 1, step: 0.01 },
    taper: { type: ControlType.Number, title: "Taper", min: 0, max: 0.4, step: 0.01 },
    zoom: { type: ControlType.Number, title: "Zoom", min: 0.5, max: 2, step: 0.01 },
    frost: { type: ControlType.Number, title: "Frost", min: 0, max: 1, step: 0.01 },
    wallThickness: { type: ControlType.Number, title: "Wall", min: 0, max: 0.45, step: 0.01 },
    speckle: { type: ControlType.Number, title: "Speckle", min: 0, max: 1, step: 0.01 },
    softness: { type: ControlType.Number, title: "Softness", min: 0.5, max: 6, step: 0.1 },
    grain: { type: ControlType.Number, title: "Grain", min: 0, max: 0.12, step: 0.002 },
    background: { type: ControlType.Color, title: "Background" },
    transparent: { type: ControlType.Boolean, title: "Transparent" },
})
