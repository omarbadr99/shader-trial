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
uniform float uYaw, uPitch;       // orbit: drag + precessing tilt (CPU)
uniform float uSpinPhase;         // rigid in-plane rotation of the shape
uniform float uOrgPhase;          // slow phase for the optional organic drift
uniform float uZoom;
uniform float uRing;              // ring radius — hole size, tube stays absolute
uniform float uTube;              // tube radius (in-plane)
uniform float uFlat;              // cross-section z-scale (flattened coin < 1)
uniform float uTaper;             // tube radius variation, rotates with shape
uniform float uLobe;              // tri-lobe amplitude (constant = rigid form)
uniform float uOrganic;           // small in-plane radius drift, default low
uniform float uInk;               // global ink multiplier
uniform float uGravity;           // ink pull toward the ring's center
uniform float uLight;             // form-light strength (3D read)
uniform float uGlare;             // area-light glare strength
uniform float uFrost;             // shell scattering strength
uniform float uWall;              // frosted wall thickness (fraction of tube radius)
uniform float uSpeckle;           // micro speckle in the plastic
uniform float uGrain;
uniform vec3  uBg;
uniform float uSoft;              // silhouette AA in pixels
uniform float uJitter;            // per-frame dither for the volume integral
uniform float uTransparent;       // 1 = emit alpha, background pixels transparent

uniform int   uBlobN;
uniform vec4  uBlobA[MAXB];       // x angle, y half-width(rad), z tail(signed), w strength
uniform vec3  uBlobAbs[MAXB];     // -log(color): per-channel absorption

/* Ring in the xy-plane, facing camera. All angular modulation uses integer
   harmonics of theta so the atan seam is invisible. */

float ringR(float ths){
  /* three localized corner bumps (mean-centered) instead of a cos wave:
     the O grows soft vertices without denting inward between them */
  float f = 0.5 + 0.5*cos(3.0*ths + 0.9);
  f = f*f;
  return uRing * (1.0
    + uLobe * 1.6 * (f - 0.375)
    + uOrganic * (0.05*cos(2.0*ths - uOrgPhase) + 0.03*sin(4.0*ths + 0.7*uOrgPhase)));
}
float tubeR(float ths){
  /* one-sided taper: thick on one side of the ring, slim opposite */
  return uTube * (1.0 + uTaper * cos(ths + 0.4));
}

float zWave(float ths){
  return uOrganic * 0.07 * uRing * sin(3.0*ths - uOrgPhase*1.3);
}

float map(vec3 p){
  float th  = atan(p.y, p.x);
  float ths = th - uSpinPhase;
  vec2 q = vec2(length(p.xy) - ringR(ths), (p.z + zWave(ths))/uFlat);
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

/* per-channel optical depth of the liquid at a point + how "core" it is */
vec3 inkOD(vec3 p, out float coreW){
  float th  = atan(p.y, p.x);
  float ths = th - uSpinPhase;
  vec2 q = vec2(length(p.xy) - ringR(ths), (p.z + zWave(ths))/uFlat);
  float r  = tubeR(ths);
  float qn = length(q) / r;                   // 0 at core .. 1 at surface
  float core = 1.0 - uWall;                   // liquid lives inside the wall
  coreW = smoothstep(core, core - 0.35, qn);

  vec3 od = vec3(0.0);
  float dens = 0.0;
  for (int i=0; i<MAXB; i++){
    if (i >= uBlobN) break;
    vec4 B = uBlobA[i];
    float d = mod(th - B.x + PI, TAU) - PI;   // wrapped angular distance
    /* asymmetric gaussian: tail side (sign of B.z) is stretched;
       faded out before the antipode so the tail closes without a seam */
    float w = B.y * (d*B.z > 0.0 ? 1.0 + 2.2*abs(B.z) : 1.0);
    float g = exp(-0.5*d*d/(w*w));
    g *= 1.0 - smoothstep(0.7*PI, PI, abs(d));
    od += uBlobAbs[i] * (B.w * g);
    dens += B.w * g;
  }

  /* ink gravity: the liquid is pulled toward the ring's center — tails and
     thin washes pack against the inner wall, but where a blob is dense it
     floods the whole tube width, like the reference */
  float rad   = clamp(q.x / r, -1.0, 1.0);    // -1 inner edge .. +1 outer edge
  float gravW = smoothstep(0.85, -0.55, rad);
  float flood = smoothstep(0.35, 1.1, dens);
  coreW *= mix(1.0, mix(gravW, 1.0, flood), uGravity);

  /* baseline cool tint of the material itself — fills the whole tube
     (wall included), so long grazing paths pick up a darker cold edge */
  return od * coreW + vec3(0.040, 0.027, 0.014);
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

  /* march with bisection refinement — tangent rays never shade inside */
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

  /* background: slight vignette + a soft shadow that pools below the
     object (key light comes from above) */
  float vig = length(uv)*0.5;
  vec3 bg = uBg * (1.0 - 0.04*vig*vig) * (1.0 + 0.008*uv.y);
  float below = smoothstep(0.15, -0.45, uv.y);
  bg *= 1.0 - (0.018 + 0.05*below*uLight) * exp(-max(minD, 0.0)*2.2);

  float wpp = tAt * 1.24 / min(uRes.x, uRes.y);
  float aa  = uSoft * wpp;
  float alpha = hit ? 1.0 : clamp(1.0 - minD/aa, 0.0, 1.0);

  vec3 col = bg;
  if (alpha > 0.0){
    float t0 = hit ? t : tAt;
    vec3 p = ro + rd*t0;
    vec3 n = calcNormal(p);

    /* find exit point, then jittered uniform sampling — no banding */
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

    /* frosted polycarbonate: scattering from total path + extra from the
       wall, so grazing edges go milky-solid and the blob keeps a pale margin */
    float milk = 1.0 - exp(-(L*uFrost*1.6 + shellT*uFrost*3.0));
    vec3 milkCol = vec3(0.985, 0.992, 1.0);

    /* molded-in micro speckle, fixed to the shape so it rotates with it */
    vec3 ps = vec3(rot2(p.xy, -uSpinPhase), p.z);
    float spk = (hash3(floor(ps*140.0)) - 0.5) * 0.055
              + (hash3(floor(ps*47.0) + 7.0) - 0.5) * 0.03;

    vec3 body = mix(bg * inkT, milkCol * exp(-od * uInk * 0.72), milk);
    body *= 1.0 + spk * uSpeckle * milk;

    /* studio light rig: one big soft key above-front. wrap diffuse keeps
       the shadow side alive, an extra term deepens the core shadow so the
       tube reads round */
    vec3 ld = normalize(vec3(-0.25, 0.85, 0.5));
    float ndl = dot(n, ld);
    float shade = 0.36 * uLight;
    float diff = (1.0 - shade) + shade*ndl;
    diff *= 1.0 - 0.15*uLight*smoothstep(0.0, -0.8, ndl);
    body *= diff;

    /* faint bounce up from the backdrop */
    body += vec3(0.018, 0.020, 0.022)
          * clamp(dot(n, normalize(vec3(0.0, -0.75, 0.65))), 0.0, 1.0)
          * milk * uLight;

    /* hazy elongated glare + soft sheen — a big area light reflected in a
       frosted surface, riding the tube's top ridge; survives over ink */
    vec3 rfl = reflect(rd, n);
    float gA = pow(max(dot(rfl, ld), 0.0), 6.0);
    float gB = pow(max(dot(rfl, ld), 0.0), 36.0);
    body += (gA*0.16 + gB*0.11) * uGlare * (0.3 + 0.7*milk)
          * mix(vec3(1.0), inkT, 0.3);

    col = mix(bg, body, alpha);
  }

  float g = hash(gl_FragCoord.xy) - 0.5;
  col += g * uGrain * (0.35 + 0.65*alpha);

  float outA = mix(1.0, alpha, uTransparent);
  O = vec4(col * outA, outA);
}`

const UNIFORMS = [
    "uRes", "uYaw", "uPitch", "uSpinPhase", "uOrgPhase", "uZoom", "uTube",
    "uRing", "uFlat", "uTaper", "uLobe", "uOrganic", "uInk", "uGravity", "uLight",
    "uGlare", "uFrost", "uWall",
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
    inkGravity: number
    formLight: number
    glare: number
    spin: number
    tiltSway: number
    tiltSpeed: number
    organicDrift: number
    wobbleSpeed: number
    shapeMorph: number
    morphSpeed: number
    ringSize: number
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
        const ph = { t: 2.5, spin: 0.3, org: 5, morph: -Math.PI / 2 }
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
                ph.org += dt * P.wobbleSpeed * 1.1
                ph.morph += dt * P.morphSpeed * 0.45
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
            gl.uniform1f(U.uRing, P.ringSize)
            gl.uniform1f(U.uTube, P.thickness)
            gl.uniform1f(U.uFlat, P.flatten)
            const mLobe = 1 - P.shapeMorph * (0.5 + 0.5 * Math.sin(ph.morph))
            const mTaper = 1 - P.shapeMorph * (0.5 + 0.5 * Math.sin(ph.morph * 0.77 + 1.9))
            gl.uniform1f(U.uTaper, P.taper * mTaper)
            gl.uniform1f(U.uLobe, P.triLobe * mLobe)
            gl.uniform1f(U.uOrganic, P.organicDrift)
            gl.uniform1f(U.uInk, P.inkAmount * 8)
            gl.uniform1f(U.uGravity, P.inkGravity)
            gl.uniform1f(U.uLight, P.formLight)
            gl.uniform1f(U.uGlare, P.glare)
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
    inkAmount: 0.9,
    inkGravity: 0.8,
    formLight: 0.7,
    glare: 0.65,
    spin: 0.2,
    tiltSway: 0.5,
    tiltSpeed: 1,
    organicDrift: 0.25,
    wobbleSpeed: 0.5,
    shapeMorph: 1,
    morphSpeed: 0.5,
    ringSize: 1,
    triLobe: 0.18,
    thickness: 0.21,
    flatten: 0.72,
    taper: 0.22,
    zoom: 1.18,
    frost: 0.45,
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
    inkGravity: { type: ControlType.Number, title: "Ink gravity", min: 0, max: 1, step: 0.01 },
    formLight: { type: ControlType.Number, title: "Form light", min: 0, max: 1, step: 0.01 },
    glare: { type: ControlType.Number, title: "Glare", min: 0, max: 1, step: 0.01 },
    spin: { type: ControlType.Number, title: "Spin", min: -1, max: 1, step: 0.01 },
    tiltSway: { type: ControlType.Number, title: "Tilt sway", min: 0, max: 1, step: 0.01 },
    tiltSpeed: { type: ControlType.Number, title: "Tilt speed", min: 0, max: 2, step: 0.01 },
    organicDrift: { type: ControlType.Number, title: "Wobble", min: 0, max: 1, step: 0.01 },
    wobbleSpeed: { type: ControlType.Number, title: "Wobble speed", min: 0, max: 2, step: 0.01 },
    shapeMorph: { type: ControlType.Number, title: "Shape morph", min: 0, max: 1, step: 0.01 },
    morphSpeed: { type: ControlType.Number, title: "Morph speed", min: 0, max: 2, step: 0.01 },
    ringSize: { type: ControlType.Number, title: "Ring size", min: 0.35, max: 1.35, step: 0.01 },
    triLobe: { type: ControlType.Number, title: "Tri-lobe", min: 0, max: 0.3, step: 0.005 },
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
