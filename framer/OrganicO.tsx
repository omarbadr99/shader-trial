import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * Organic O — fluid ink ring (WebGL2 raymarching shader)
 *
 * A frosted-glass rounded-triangle ring with a dark ink mass that flows
 * around the tube while the shape wobbles and slowly spins.
 * Same shader as organic-o/index.html in the shader-trial repo.
 *
 * Drop it on the page and size the frame — the ring scales to fit.
 * All dials are native Framer controls in the right sidebar.
 */

const VERT = `#version 300 es
void main(){
  vec2 v = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  gl_Position = vec4(v*2.0-1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
out vec4 O;

uniform vec2  uRes;
uniform float uYaw, uPitch;
uniform float uSpinPhase;
uniform float uWob;
uniform float uFlow1, uFlow2;
uniform float uZoom;
uniform float uTube;
uniform float uTaper;
uniform float uLobe;
uniform float uWobAmp;
uniform float uInk;
uniform float uSpreadPow;
uniform float uBlob2;
uniform vec3  uInkCol;
uniform float uFrost;
uniform float uGrain;
uniform vec3  uBg;
uniform float uSoft;
uniform float uTransparent;   // 1 = emit alpha, background pixels transparent

float map(vec3 p){
  float th  = atan(p.y, p.x);
  float ths = th - uSpinPhase;
  float R = 1.0
    + uLobe * cos(3.0*ths + 0.9)
    + uWobAmp * (0.10*cos(2.0*ths - uWob) + 0.06*sin(4.0*ths + uWob*0.7));
  float z = p.z + uWobAmp * 0.10 * sin(3.0*ths - uWob*1.31);
  vec2 q = vec2(length(p.xy) - R, z);
  float r = uTube * (1.0 + uTaper*cos(2.0*ths - uWob*0.6) + uLobe*0.5*sin(3.0*ths + 1.7));
  return (length(q) - r) * 0.72;
}

vec3 calcNormal(vec3 p){
  const vec2 e = vec2(0.002, -0.002);
  return normalize(
    e.xyy*map(p+e.xyy) + e.yyx*map(p+e.yyx) +
    e.yxy*map(p+e.yxy) + e.xxx*map(p+e.xxx));
}

float inkDen(vec3 p){
  float th = atan(p.y, p.x);
  float b1 = pow(0.5 + 0.5*cos(th - uFlow1), uSpreadPow);
  float b2 = pow(0.5 + 0.5*cos(th - uFlow2), uSpreadPow*0.7);
  return b1 + uBlob2*b2 + 0.02;
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

mat3 orbit(float yaw, float pitch){
  float cy=cos(yaw), sy=sin(yaw), cp=cos(pitch), sp=sin(pitch);
  mat3 ry = mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
  mat3 rx = mat3(1.,0.,0., 0.,cp,sp, 0.,-sp,cp);
  return ry*rx;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);

  mat3 M = orbit(uYaw, uPitch);
  float camD = 8.0/uZoom;
  vec3 ro = M * vec3(0.0, 0.0, camD);
  vec3 rd = M * normalize(vec3(uv*0.62, -1.0));

  float t = max(0.0, camD - 2.6);
  float minD = 1e9, tAt = t;
  bool hit = false;
  for (int i=0; i<120; i++){
    vec3 p = ro + rd*t;
    float d = map(p);
    if (d < minD){ minD = d; tAt = t; }
    if (d < 0.0012){ hit = true; break; }
    t += d;
    if (t > camD + 2.6) break;
  }

  float vig = length(uv)*0.55;
  vec3 bg = uBg * (1.0 - 0.045*vig*vig) * (1.0 + 0.012*uv.y);
  bg *= 1.0 - 0.05 * exp(-max(minD,0.0)*3.0);

  float wpp = tAt * 1.24 / min(uRes.x, uRes.y);
  float aa  = uSoft * wpp;
  float alpha = hit ? 1.0 : clamp(1.0 - minD/aa, 0.0, 1.0);

  vec3 col = bg;
  if (alpha > 0.0){
    float th0 = hit ? t : tAt;
    vec3 p = ro + rd*th0;
    vec3 n = calcNormal(p);

    float sigma = 0.0, thick = 0.0;
    float ti = th0 + 0.004;
    for (int i=0; i<28; i++){
      vec3 q = ro + rd*ti;
      float d = map(q);
      if (d > 0.004) break;
      float st = max(-d*1.1, 0.014);
      sigma += inkDen(q) * st;
      thick += st;
      ti += st;
    }

    vec3 inkC = clamp(uInkCol, vec3(0.02), vec3(1.0));
    float s = sigma * uInk;
    vec3 Tink = pow(inkC, vec3(s));

    float milk = 1.0 - exp(-thick * uFrost);
    vec3 milkCol = vec3(0.955, 0.972, 0.99);
    vec3 body = mix(bg * 1.02 * Tink, milkCol * pow(inkC, vec3(s*0.8)), milk);

    float topLight = 0.5 + 0.5*n.y;
    body *= 0.90 + 0.12*topLight;
    float fres = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);
    body += fres * vec3(0.10, 0.11, 0.13) * (0.3 + 0.7*milk) * (0.2 + 0.8*Tink);
    vec3 ld = normalize(vec3(-0.45, 0.85, 0.55));
    body += pow(max(dot(reflect(rd, n), ld), 0.0), 14.0) * 0.10 * (0.3 + 0.7*Tink);

    col = mix(bg, body, alpha);
  }

  float g = hash(gl_FragCoord.xy) - 0.5;
  col += g * uGrain * (0.3 + 0.7*alpha);

  float outA = mix(1.0, alpha, uTransparent);
  O = vec4(col * outA, outA);
}`

const UNIFORMS = [
    "uRes", "uYaw", "uPitch", "uSpinPhase", "uWob", "uFlow1", "uFlow2",
    "uZoom", "uTube", "uTaper", "uLobe", "uWobAmp", "uInk", "uSpreadPow",
    "uBlob2", "uInkCol", "uFrost", "uGrain", "uBg", "uSoft", "uTransparent",
]

function parseColor(c: string): [number, number, number] {
    if (!c) return [0.11, 0.17, 0.28]
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
    return [0.11, 0.17, 0.28]
}

interface Props {
    inkColor: string
    background: string
    transparent: boolean
    flowSpeed: number
    inkAmount: number
    inkSpread: number
    secondBlob: number
    frost: number
    thickness: number
    taper: number
    shape: number
    wobble: number
    wobbleSpeed: number
    spin: number
    zoom: number
    softness: number
    grain: number
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

        const ph = { flow1: 2.1, flow2: 4.8, wob: 5, spin: 0.3, t: 2.5 }
        let last = performance.now()
        let raf = 0
        let disposed = false

        const draw = (now: number) => {
            if (disposed) return
            const P = propsRef.current
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now
            if (!isCanvas) {
                ph.t += dt
                ph.wob += dt * P.wobbleSpeed * 1.1
                ph.spin += dt * P.spin * 0.35
                ph.flow1 += dt * P.flowSpeed
                ph.flow2 += dt * P.flowSpeed * 0.62
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w
                canvas.height = h
                gl.viewport(0, 0, w, h)
            }

            const idleYaw = 0.16 * Math.sin(ph.t * 0.21)
            const idlePitch = 0.22 * Math.sin(ph.t * 0.146 + 1.7)
            const breathe = 1 + 0.015 * Math.sin(ph.t * 0.23)
            const bg = parseColor(P.background)

            gl.uniform2f(U.uRes, w, h)
            gl.uniform1f(U.uYaw, idleYaw)
            gl.uniform1f(U.uPitch, idlePitch)
            gl.uniform1f(U.uSpinPhase, ph.spin)
            gl.uniform1f(U.uWob, ph.wob)
            gl.uniform1f(U.uFlow1, ph.flow1)
            gl.uniform1f(U.uFlow2, ph.flow2)
            gl.uniform1f(U.uZoom, P.zoom * breathe)
            gl.uniform1f(U.uTube, P.thickness)
            gl.uniform1f(U.uTaper, P.taper)
            gl.uniform1f(U.uLobe, P.shape)
            gl.uniform1f(U.uWobAmp, P.wobble)
            gl.uniform1f(U.uInk, P.inkAmount * 10)
            gl.uniform1f(U.uSpreadPow, 26 - 23 * P.inkSpread)
            gl.uniform1f(U.uBlob2, P.secondBlob)
            gl.uniform3fv(U.uInkCol, parseColor(P.inkColor))
            gl.uniform1f(U.uFrost, P.frost * 2.2)
            gl.uniform1f(U.uGrain, P.grain)
            gl.uniform3fv(U.uBg, bg)
            gl.uniform1f(U.uSoft, P.softness)
            gl.uniform1f(U.uTransparent, P.transparent ? 1 : 0)

            gl.drawArrays(gl.TRIANGLES, 0, 3)
            if (!isCanvas) raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)

        return () => {
            disposed = true
            cancelAnimationFrame(raf)
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
    inkColor: "#1D2B47",
    background: "#EFF1F3",
    transparent: false,
    flowSpeed: 0.55,
    inkAmount: 0.72,
    inkSpread: 0.42,
    secondBlob: 0.3,
    frost: 0.85,
    thickness: 0.3,
    taper: 0.22,
    shape: 0.14,
    wobble: 0.5,
    wobbleSpeed: 0.55,
    spin: 0.18,
    zoom: 1,
    softness: 3,
    grain: 0.035,
}

addPropertyControls(OrganicO, {
    inkColor: { type: ControlType.Color, title: "Ink" },
    background: { type: ControlType.Color, title: "Background" },
    transparent: { type: ControlType.Boolean, title: "Transparent" },
    flowSpeed: {
        type: ControlType.Number, title: "Flow speed",
        min: -2, max: 2, step: 0.01,
    },
    inkAmount: {
        type: ControlType.Number, title: "Ink amount",
        min: 0, max: 1, step: 0.01,
    },
    inkSpread: {
        type: ControlType.Number, title: "Ink spread",
        min: 0, max: 1, step: 0.01,
    },
    secondBlob: {
        type: ControlType.Number, title: "Second blob",
        min: 0, max: 1, step: 0.01,
    },
    frost: {
        type: ControlType.Number, title: "Frost",
        min: 0, max: 1, step: 0.01,
    },
    thickness: {
        type: ControlType.Number, title: "Thickness",
        min: 0.1, max: 0.45, step: 0.005,
    },
    taper: {
        type: ControlType.Number, title: "Taper",
        min: 0, max: 0.5, step: 0.01,
    },
    shape: {
        type: ControlType.Number, title: "Shape",
        min: 0, max: 0.3, step: 0.005,
    },
    wobble: {
        type: ControlType.Number, title: "Wobble",
        min: 0, max: 1, step: 0.01,
    },
    wobbleSpeed: {
        type: ControlType.Number, title: "Wobble speed",
        min: 0, max: 2, step: 0.01,
    },
    spin: {
        type: ControlType.Number, title: "Spin",
        min: -1, max: 1, step: 0.01,
    },
    zoom: {
        type: ControlType.Number, title: "Zoom",
        min: 0.5, max: 2, step: 0.01,
    },
    softness: {
        type: ControlType.Number, title: "Softness",
        min: 0.5, max: 8, step: 0.1,
    },
    grain: {
        type: ControlType.Number, title: "Grain",
        min: 0, max: 0.12, step: 0.002,
    },
})
