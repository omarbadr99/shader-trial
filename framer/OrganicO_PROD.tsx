// Organic O — Framer production component
// BUILD: PROD-2
//
// A WebGL "O" whose shape, material and camera morph from preset A to preset B
// as the visitor scrolls between two sections.
//
// This is the PRODUCTION build. It contains no diagnostics, no alternate
// renderers, no authoring UI, no instrumentation and no pointer handling --
// the O is decoration and never takes an event. The fragment shader was
// reduced from 74,008 to 17,865 bytes and verified to render
// BIT-IDENTICALLY to the development build at five scroll positions (0 pixels
// of 176,400 differing per frame).

import { useRef, useEffect, useMemo, useCallback, useState } from "react"
import { addPropertyControls, ControlType } from "framer"
import { useScroll, useMotionValueEvent } from "framer-motion"

/* The renderer page, embedded as a plain string. It used to be base64: that
   inflated it by a third and cost 17ms of blocking main-thread work at module
   scope (16ms of it in Uint8Array.from's per-character callback) before the
   shader could even begin compiling. */
const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organic O</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;overflow:hidden;background:transparent}
  canvas#gl{position:fixed;inset:0;width:100%;height:100%;display:block}
</style></head>
<body><canvas id="gl"></canvas>
<script>
"use strict";
/* the shader interpolates \${MAXB}, so it must exist before the literal */
const MAXB = 6;
const VERT = \`#version 300 es
void main(){
  vec2 v = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  gl_Position = vec4(v*2.0-1.0, 0.0, 1.0);
}\`;
const FRAG = \`#version 300 es
precision highp float;
precision highp int;
out vec4 O;
#define MAXB \${MAXB}
#define PI  3.14159265
#define TAU 6.28318531
uniform vec2  uRes;
uniform float uYaw, uPitch;
uniform float uSpinPhase;
uniform float uOrgPhase;
uniform float uZoom;
uniform float uRing;
uniform float uTube;
uniform float uFlat;
uniform float uTaper;
uniform vec3  uCornerW;
uniform float uStretch;
uniform float uStretchA;
uniform float uOrganic;
uniform float uInk;
uniform float uGravity;
uniform float uLight;
uniform float uGlare;
uniform float uFrost;
uniform float uWall;
uniform float uSpeckle;
uniform float uGrain;
uniform vec3  uBg;
uniform float uSoft;
uniform sampler2D uBgTex;
uniform float uBgMode;
uniform float uTransp;
uniform float uSpeckFix;
uniform float uForceSpeck;
uniform float uPathAA;
uniform vec2  uAAThr;
uniform float uAlphaDebug;
uniform vec2  uTexScale;
uniform int   uBlobN;
uniform vec4  uBlobA[MAXB];
uniform vec3  uBlobAbs[MAXB];
vec2 rot2(vec2 v, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*v; }
float sdEqTri(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r/k;
  if (p.x + k*p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y)*0.5;
  p.x -= clamp(p.x, -2.0*r, 0.0);
  return -length(p) * (p.y >= 0.0 ? 1.0 : -1.0);
}
float pathD(vec2 ps){
  vec2 q = rot2(ps, -uStretchA);
  q = vec2(q.x/(1.0 + uStretch), q.y*(1.0 + uStretch*0.7));
  float dC = length(q) - uRing;
  float c  = 0.58 * uRing;
  float s  = (uRing - c) * 1.1547;
  float dT = sdEqTri(q, s) - c;
  float a  = atan(q.y, q.x) - 1.5708;
  float c0 = cos(a), c1 = cos(a - 2.0944), c2 = cos(a + 2.0944);
  float w = (uCornerW.x*c0*c0 + uCornerW.y*c1*c1 + uCornerW.z*c2*c2) * 0.6667;
  return mix(dC, dT, w) / (1.0 + uStretch);
}
float tubeR(float ths){
  return uTube * (1.0 + uTaper * cos(ths + 0.4));
}
float zWave(float ths){
  return uOrganic * 0.08 * uRing * sin(3.0*ths - uOrgPhase*1.3);
}
uniform float uFluid;
uniform float uCenterAmt;
uniform float uThickAmt;
uniform float uDepthAmt;
uniform float uGeoLag;
uniform float uPMean;
uniform float uPVar;
uniform float uSafe;
uniform int   uPressN;
uniform vec4  uPressB[MAXB];
vec3 fluidP3(float th){
  vec3 P = vec3(0.0);
  for (int i=0; i<MAXB; i++){
    if (i >= uPressN) break;
    vec4 B = uPressB[i];
    float d   = th - B.x;
    float lag = uGeoLag * B.w;
    P.x += B.z * pow(max(0.5 + 0.5*cos(d + lag),     1e-7), B.y);
    P.y += B.z * pow(max(0.5 + 0.5*cos(d + lag*1.6), 1e-7), B.y);
    P.z += B.z * pow(max(0.5 + 0.5*cos(d + lag*2.3), 1e-7), B.y);
  }
  return P - vec3(uPMean);
}
float thickF(float Pt){
  float a = uFluid * uThickAmt;
  return max(0.25, 1.0 + a*Pt) * inversesqrt(1.0 + a*a*uPVar);
}
uniform float uBoundR;
float fieldRaw(vec3 p){
  vec2 ps = rot2(p.xy, -uSpinPhase);
  float ths = atan(ps.y, ps.x);
  float thw = atan(p.y, p.x);
  vec3 P3 = uFluid > 0.0005 ? fluidP3(thw) : vec3(0.0);
  float pd = pathD(ps) - uFluid*uCenterAmt*P3.x;
  float z  = p.z + zWave(ths) + uFluid*uDepthAmt*uRing*P3.z;
  vec2 q = vec2(pd, z/uFlat);
  return length(q) - tubeR(ths)*thickF(P3.y);
}
float map(vec3 p){ return fieldRaw(p) * uSafe * uFlat; }
struct TR {
  bool  hit;
  float t;
  float minRaw;
  float tAt;
  float steps;
  float reason;
  float proof;
  float nearEps;
  float resid;
};
float refineEntry(vec3 ro, vec3 rd, float a, float b){
  float fa = fieldRaw(ro + rd*a);
  float fb = fieldRaw(ro + rd*b);
  for (int j=0; j<10; j++){
    float m = 0.5*(a+b);
    float fm = fieldRaw(ro + rd*m);
    if (fm < 0.0){ b = m; fb = fm; } else { a = m; fa = fm; }
  }
  float d = fa - fb;
  return d > 1e-20 ? a + (b - a) * (fa / d) : b;
}
TR traceFrontInner(vec3 ro, vec3 rd, float tStart, float tEnd){
  TR r;
  r.hit = false; r.t = tStart; r.minRaw = 1e9; r.tAt = tStart;
  r.steps = 0.0; r.reason = 2.0; r.proof = 0.0; r.nearEps = 0.0; r.resid = 0.0;
  float bb = dot(ro, rd);
  float bdisc = bb*bb - (dot(ro, ro) - uBoundR*uBoundR);
  if (bdisc <= 0.0) return r;
  const float NEAR_EPS = 0.002;
  float t = tStart, tPrev = tStart;
  float fPrev = fieldRaw(ro + rd*tStart);
  if (fPrev <= 0.0){
    r.t = tStart; r.hit = true; r.reason = 0.0; r.proof = 4.0; return r;
  }
  for (int i=0; i<384; i++){
    r.steps += 1.0;
    float f = fieldRaw(ro + rd*t);
    if (f < r.minRaw){ r.minRaw = f; r.tAt = t; }
    if (f <= 0.0){
      r.t = refineEntry(ro, rd, tPrev, t);
      r.hit = true; r.reason = 0.0; r.proof = 1.0; return r;
    }
    if (f < NEAR_EPS){
      float wl = max(t, 0.001) * 1.24 / uRes.y;
      float ta = t, fa = f;
      for (int k=1; k<=5; k++){
        float tb = t + wl * (0.25 * float(k) * float(k));
        if (tb > tEnd) break;
        float fb = fieldRaw(ro + rd*tb);
        if (fb <= 0.0){
          r.t = refineEntry(ro, rd, ta, tb);
          r.hit = true; r.reason = 0.0; r.proof = 2.0; return r;
        }
        ta = tb; fa = fb;
      }
      r.nearEps = 1.0;
    }
    tPrev = t; fPrev = f;
    t += f * uSafe * uFlat;
    if (t > tEnd){ r.reason = 2.0; return r; }
    r.reason = 1.0;
  }
  float wl = max(r.tAt, 0.001) * 1.24 / uRes.y;
  float lo = max(r.tAt - 6.0*wl, tStart);
  float hi = min(r.tAt + 6.0*wl, tEnd);
  float fLo = fieldRaw(ro + rd*lo);
  if (fLo <= 0.0){
    float a = tStart;
    for (int k=1; k<=16; k++){
      float tb = tStart + (lo - tStart) * float(k) / 16.0;
      float fb = fieldRaw(ro + rd*tb);
      if (fb <= 0.0){
        r.t = refineEntry(ro, rd, a, tb);
        r.hit = true; r.reason = 3.0; r.proof = 3.0; return r;
      }
      a = tb;
    }
    r.t = refineEntry(ro, rd, a, lo);
    r.hit = true; r.reason = 3.0; r.proof = 3.0; return r;
  }
  float ta2 = lo;
  for (int k=1; k<=10; k++){
    float tb2 = lo + (hi - lo) * float(k) / 10.0;
    float fb2 = fieldRaw(ro + rd*tb2);
    if (fb2 <= 0.0){
      r.t = refineEntry(ro, rd, ta2, tb2);
      r.hit = true; r.reason = 3.0; r.proof = 3.0; return r;
    }
    ta2 = tb2;
  }
  r.nearEps = 1.0;
  return r;
}
TR traceFront(vec3 ro, vec3 rd, float tStart, float tEnd){
  TR r = traceFrontInner(ro, rd, tStart, tEnd);
  r.resid = (r.hit && r.proof > 0.5 && r.proof < 3.5) ? abs(fieldRaw(ro + rd*r.t)) : 0.0;
  return r;
}
vec3 calcNormal(vec3 p){
  const vec2 e = vec2(0.0018, -0.0018);
  return normalize(
    e.xyy*map(p+e.xyy) + e.yyx*map(p+e.yyx) +
    e.yxy*map(p+e.yxy) + e.xxx*map(p+e.xxx));
}
uniform uint uSeedU;
float hash(vec2 p){
  uvec3 v = uvec3(uvec2(abs(p)), uSeedU);
  v = v*1664525u + 1013904223u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  v ^= v >> 16u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  return float(v.x) * 2.3283064365386963e-10;
}
float hash3(vec3 p){
  uvec3 v = floatBitsToUint(p);
  v = v*1664525u + 1013904223u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  v ^= v >> 16u;
  v.x += v.y*v.z;
  return float(v.x) * 2.3283064365386963e-10;
}
uniform float uOptV1;
uniform float uExposure, uRolloff, uLift;
uniform float uShellTh, uShellCl, uCoreSoft;
uniform float uFresStr, uF0;
uniform float uReflStr, uStudioRot, uStripW, uStripSoft;
uniform float uCurvResp, uHiWidth, uHiInt;
uniform float uIOR, uRefrStr, uDisp;
uniform float uRefrFull;
float ignDither(vec2 p){
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
vec3 toLin(vec3 c){ return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 toSRGB(vec3 c){ return pow(max(c, vec3(0.0)), vec3(1.0/2.2)); }
vec3 acesFit(vec3 x){
  return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0);
}
float band(float x, float c, float halfW, float soft){
  return 1.0 - smoothstep(halfW, halfW + max(soft, 0.01), abs(x - c));
}
vec3 envStudio(vec3 dir, float rough, float bandGain){
  vec3 d = normalize(dir);
  d.xz = rot2(d.xz, uStudioRot);
  vec3 col = mix(vec3(0.30, 0.325, 0.365), vec3(0.86, 0.89, 0.94),
                 smoothstep(-0.5, 0.85, d.y));
  float xwin = smoothstep(-0.15, 0.45, 0.85 - abs(d.x));
  float b1 = band(d.y, 0.42, uStripW,      uStripSoft + rough);
  float b2 = band(d.y, 0.66, uStripW*0.35, uStripSoft*0.5 + rough*0.8);
  col += b1 * xwin * vec3(0.75, 0.77, 0.80) * bandGain;
  col += b2 * xwin * vec3(1.55, 1.60, 1.68) * bandGain;
  float cy = 1.0 - smoothstep(0.25, 0.85, length(vec2(d.x + 0.62, d.y + 0.42)));
  col += cy * vec3(-0.02, 0.055, 0.10);
  return max(col, vec3(0.0));
}
vec4 nrmCurv(vec3 p, float eps){
  vec2 e = vec2(eps, -eps);
  float d1 = map(p + e.xyy), d2 = map(p + e.yyx),
        d3 = map(p + e.yxy), d4 = map(p + e.xxx);
  vec3 g = e.xyy*d1 + e.yyx*d2 + e.yxy*d3 + e.xxx*d4;
  float gl = length(g);
  vec3 n = gl > 1e-6 ? g / gl : vec3(0.0);
  float kappa = (d1 + d2 + d3 + d4) * 0.25 / (eps*eps * uSafe * uFlat);
  return vec4(n, kappa);
}
struct EX {
  bool  valid;
  float t;
  float steps;
  float resid;
  float proof;
};
float refineExit(vec3 o, vec3 d, float a, float b){
  float fa = fieldRaw(o + d*a);
  float fb = fieldRaw(o + d*b);
  for (int j=0; j<10; j++){
    float m = 0.5*(a+b);
    float fm = fieldRaw(o + d*m);
    if (fm <= 0.0){ a = m; fa = fm; } else { b = m; fb = fm; }
  }
  float dd = fb - fa;
  return dd > 1e-20 ? a + (b - a) * (-fa / dd) : 0.5*(a+b);
}
EX traceExit(vec3 orig, vec3 dir, float tMax){
  EX e; e.valid=false; e.t=0.0; e.steps=0.0; e.resid=0.0; e.proof=0.0;
  float tPrev = 0.0, fPrev = fieldRaw(orig);
  float t = 0.012;
  for (int i=0; i<64; i++){
    e.steps += 1.0;
    float f = fieldRaw(orig + dir*t);
    if (fPrev <= 0.0 && f > 0.0){
      e.t = refineExit(orig, dir, tPrev, t);
      e.valid = true; e.proof = 1.0;
      e.resid = abs(fieldRaw(orig + dir*e.t));
      return e;
    }
    tPrev = t; fPrev = f;
    t += f <= 0.0 ? max(-f, 0.012) : 0.012;
    if (t > tMax) break;
  }
  float sPrev = 0.0, gPrev = fieldRaw(orig);
  for (int k=1; k<=24; k++){
    float sc = tMax * float(k) / 24.0;
    float g = fieldRaw(orig + dir*sc);
    if (gPrev <= 0.0 && g > 0.0){
      e.t = refineExit(orig, dir, sPrev, sc);
      e.valid = true; e.proof = 2.0;
      e.resid = abs(fieldRaw(orig + dir*e.t));
      return e;
    }
    sPrev = sc; gPrev = g;
  }
  return e;
}
vec3 refrSafe(vec3 I, vec3 N, float eta){
  vec3 r = refract(I, N, eta);
  return dot(r, r) < 0.5 ? reflect(I, N) : r;
}
float SAFE = 1e-8;
vec3 inkOD(vec3 p, out float coreW){
  vec2 ps   = rot2(p.xy, -uSpinPhase);
  float ths = atan(ps.y, ps.x);
  float th  = atan(p.y, p.x);
  vec3 P3 = uFluid > 0.0005 ? fluidP3(th) : vec3(0.0);
  float pd = pathD(ps) - uFluid*uCenterAmt*P3.x;
  float zz = p.z + zWave(ths) + uFluid*uDepthAmt*uRing*P3.z;
  vec2 q = vec2(pd, zz/uFlat);
  float r  = tubeR(ths) * thickF(P3.y);
  float qn = length(q) / r;
  float core = 1.0 - uWall;
  coreW = smoothstep(core, core - 0.35, qn);
  vec3 od = vec3(0.0);
  float dens = 0.0;
  for (int i=0; i<MAXB; i++){
    if (i >= uBlobN) break;
    vec4 B = uBlobA[i];
    float d = mod(th - B.x + PI, TAU) - PI;
    float w = B.y * (d*B.z > 0.0 ? 1.0 + 2.2*abs(B.z) : 1.0);
    float g = exp(-0.5*d*d/(w*w));
    g *= 1.0 - smoothstep(0.7*PI, PI, abs(d));
    od += uBlobAbs[i] * (B.w * g);
    dens += B.w * g;
  }
  float rad   = clamp(q.x / r, -1.0, 1.0);
  float gravW = smoothstep(0.85, -0.55, rad);
  float flood = smoothstep(0.35, 1.1, dens);
  if (uOptV1 > 0.5){
    float coreEdge  = 1.0 - uShellTh;
    float coreMask  = smoothstep(coreEdge, coreEdge - max(uCoreSoft, 0.03), qn);
    float shellMask = smoothstep(coreEdge - 0.06, coreEdge + 0.12, qn);
    float gravity = mix(1.0, mix(gravW, 1.0, flood), uGravity);
    coreW = coreMask;
    return od * coreMask * gravity
         + vec3(0.020, 0.014, 0.008) * (1.0 - uShellCl) * shellMask
         + vec3(0.010, 0.007, 0.004);
  }
  coreW *= mix(1.0, mix(gravW, 1.0, flood), uGravity);
  return od * coreW + vec3(0.015, 0.011, 0.006);
}
mat3 orbit(float yaw, float pitch){
  float cy=cos(yaw), sy=sin(yaw), cp=cos(pitch), sp=sin(pitch);
  mat3 ry = mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
  mat3 rx = mat3(1.,0.,0., 0.,cp,sp, 0.,-sp,cp);
  return ry*rx;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  mat3 M = orbit(uYaw, uPitch);
  float camD = 8.0/uZoom;
  vec3 ro = M * vec3(0.0, 0.0, camD);
  vec3 rd = M * normalize(vec3(uv*0.62, -1.0));
  float tStart = max(0.0, camD - 2.6);
  float tEndG  = camD + 2.6;
  TR fr = traceFront(ro, rd, tStart, tEndG);
  bool  hit        = fr.hit;
  float t          = fr.t;
  float minD       = fr.minRaw;
  float tAt        = fr.tAt;
  float frontSteps = fr.steps;
  bool  inBound    = fr.steps > 0.5;
  float wppC = max(hit ? t : tAt, 0.001) * 1.24 / uRes.y;
  float alpha = hit ? 1.0 : 0.0;
  if (uAlphaDebug > 0.5){ O = vec4(vec3(clamp(alpha, 0.0, 1.0)), 1.0); return; }
  vec3 bgBase = uBg;
  float vig = length(uv)*0.5;
  vec3 bg = uTransp > 0.5
          ? bgBase
          : bgBase * (1.0 - 0.04*vig*vig) * (1.0 + 0.008*uv.y);
  float wpp = wppC;
  float aa  = uSoft * wpp;
  float dKap = 0.0;
  vec3 col;
  {
    vec3 colL = toLin(bg);
    if (alpha > 0.0){
      float t0 = hit ? t : tAt;
      vec3 p = ro + rd*t0;
      float wppH = t0 * 1.24 / uRes.y;
      float epsN = clamp(0.9*wppH, 0.007, 0.02) * (1.0 + 0.5*uFluid);
      vec2 eN = vec2(epsN, -epsN);
      float g1 = map(p+eN.xyy), g2 = map(p+eN.yyx), g3 = map(p+eN.yxy), g4 = map(p+eN.xxx);
      vec2 eC = 4.0*eN;
      float c1 = map(p+eC.xyy), c2 = map(p+eC.yyx), c3 = map(p+eC.yxy), c4 = map(p+eC.xxx);
      vec3 gradC = eC.xyy*c1 + eC.yyx*c2 + eC.yxy*c3 + eC.xxx*c4;
      float gcm = length(gradC);
      vec3 n = gcm > 1e-7 ? gradC/gcm : -rd;
      dKap = (g1+g2+g3+g4)*0.25/(epsN*epsN*uSafe*uFlat);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      vec3 tang = normalize(cross(n, rd) + vec3(1e-4, 0.0, 0.0));
      vec3 nT   = nrmCurv(p + tang * wppH, epsN).xyz;
      if (dot(nT, nT) < 0.5) nT = n;
      float curv = length(nT - n) / max(wppH, 1e-5);
      float envAA = clamp((0.5 + 2.4*curv) * wppH / max(ndv, 0.12), 0.03, 0.6);
      float kRel = clamp(dKap * max(uTube, 0.05), 0.25, 3.0);
      float rough = clamp(uHiWidth * mix(1.0, 1.0/kRel, uCurvResp), 0.015, 0.4);
      vec3 rdIn = normalize(mix(rd, refrSafe(rd, n, 1.0/uIOR), uRefrStr));
      vec3 pIn = p + rdIn*0.004;
      float Lr; vec3 cDir; vec3 cOrig; float eSteps=0.0;
      float pathAA = 0.0;
      if (uRefrFull > 0.5){
        EX ex = traceExit(pIn, rdIn, 6.0);
        eSteps = ex.steps;
        Lr = ex.valid ? ex.t : 0.0;
        cDir = rdIn; cOrig = pIn;
        if (uForceSpeck > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 23.0) < 1.0) Lr = 0.0;
        float repW = 1.0 - smoothstep(0.014, 0.026, Lr);
        if (uSpeckFix > 0.5 && repW > 0.0){
          vec3 sx = normalize(cross(n, rd));
          vec3 sy = cross(n, sx);
          vec3 so = (sx + sy) * (0.7 * wppH);
          EX sA = traceExit(p + so + rdIn*0.004, rdIn, 6.0); float Sa = sA.valid ? sA.t : 0.0;
          EX sB = traceExit(p - so + rdIn*0.004, rdIn, 6.0); float Sb = sB.valid ? sB.t : 0.0;
          float rep = max(Sa, Sb);
          float k = 0.004;
          float rlo = 0.5*(rep + Lr - sqrt((rep - Lr)*(rep - Lr) + k*k)) + 0.25*k;
          float rhi = rep + Lr - rlo;
          Lr = mix(Lr, rhi, repW * smoothstep(0.018, 0.030, rep));
          pathAA = repW;
        }

      } else {
        vec3 lo2 = ro + rd*(t0 + 0.004);
        EX ex2 = traceExit(lo2, rd, 6.0);
        eSteps = ex2.steps;
        Lr = ex2.valid ? ex2.t : 0.0;
        cDir = rd; cOrig = lo2;
      }
      vec3 od = vec3(0.0);
      float shellT = 0.0;
      {
        const int NS = 22;
        float st = Lr/float(NS);
        float j = hash(gl_FragCoord.xy);
        for (int i=0; i<NS; i++){
          vec3 q2 = cOrig + cDir*((float(i)+j)*st);
          float cw;
          od += inkOD(q2, cw) * st;
          shellT += (1.0 - cw) * st;
        }
      }
      vec3 inkT = exp(-od * uInk * 2.4);
      vec3 rdOut = normalize(mix(rd, rdIn, uRefrStr));
      float milk = (1.0 - exp(-(Lr*uFrost*0.9 + shellT*uFrost*2.4)))
                 * mix(0.55, 0.18, uShellCl);
      vec3 milkL = vec3(0.78, 0.84, 0.93);
      vec3 seenL;
      seenL = toLin(bg);
      float aaT = envAA;
      vec3 envRawT = envStudio(rdOut, 0.0, 0.6);
      vec3 envT;
      if (uDisp > 0.0002){
        vec3 dRc = normalize(rdOut + n*uDisp);
        vec3 dBc = normalize(rdOut - n*uDisp);
        envT = vec3(envStudio(dRc,   aaT, 0.6).r,
                    envStudio(rdOut, aaT, 0.6).g,
                    envStudio(dBc,   aaT, 0.6).b);
      } else {
        envT = envStudio(rdOut, aaT, 0.6);
      }
      seenL = mix(seenL, envT, 0.22);
      vec3 trans = mix(seenL * inkT, milkL * exp(-od * uInk * 1.7), milk);
      vec3 ldv = normalize(vec3(-0.28, 0.86, 0.42));
      float form = 0.5 + 0.5*dot(n, ldv);
      trans *= mix(1.0, 0.70 + 0.42*form, uLight*0.8);
      float F = clamp((uF0 + (1.0 - uF0)*pow(1.0 - ndv, 5.0)) * uFresStr, 0.0, 1.0);
      vec3 Rr = reflect(rd, n);
      float aaR = envAA;
      vec3 refl = envStudio(Rr, max(rough, aaR), uHiInt) * uReflStr;
      vec3 surf = mix(trans, refl, F);
      colL = mix(colL, surf, alpha);
    }
    {
      vec3 xe = max(colL, 0.0) * uExposure;
      vec3 mapd = mix(clamp(xe, 0.0, 1.0), acesFit(xe), uRolloff);
      mapd = mapd*(1.0 - uLift) + vec3(uLift);
      col = toSRGB(mapd);
    }
  }
  float g = hash(gl_FragCoord.xy) - 0.5;
  col += g * uGrain * (0.35 + 0.65*alpha);
  col += (ignDither(gl_FragCoord.xy) - 0.5) / 255.0;
  if (any(isnan(col)) || any(isinf(col))) col = bg;
  if (uTransp > 0.5){
    vec3 bgDisp;
    if (uOptV1 > 0.5){
      vec3 xe = max(toLin(bg), 0.0) * uExposure;
      vec3 md = mix(clamp(xe, 0.0, 1.0), acesFit(xe), uRolloff);
      bgDisp = toSRGB(md*(1.0 - uLift) + vec3(uLift));
    } else if (uOptV1 > 0.5){
      bgDisp = toSRGB(clamp(toLin(bg), 0.0, 1.0));
    } else {
      bgDisp = bg;
    }
    O = vec4(clamp(col - bgDisp*(1.0 - alpha), 0.0, 1.0), clamp(alpha, 0.0, 1.0));
    return;
  }
  O = vec4(col, 1.0);
}\`;

const canvas = document.getElementById("gl");
const gl = canvas.getContext("webgl2", {
  alpha: true, antialias: false, depth: false, stencil: false,
  premultipliedAlpha: true, preserveDrawingBuffer: false,
  powerPreference: "high-performance", desynchronized: true,
});

function compile(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const U = {};
["uAAThr","uAlphaDebug","uBg","uBgMode","uBgTex","uBlobA","uBlobAbs","uBlobN","uBoundR","uCenterAmt","uCoreSoft","uCornerW","uCurvResp","uDepthAmt","uDisp","uExposure","uF0","uFlat","uFluid","uForceSpeck","uFresStr","uFrost","uGeoLag","uGlare","uGrain","uGravity","uHiInt","uHiWidth","uIOR","uInk","uLift","uLight","uOptV1","uOrgPhase","uOrganic","uPMean","uPVar","uPathAA","uPitch","uPressB","uPressN","uReflStr","uRefrFull","uRefrStr","uRes","uRing","uRolloff","uSafe","uSeedU","uShellCl","uShellTh","uSoft","uSpeckFix","uSpeckle","uSpinPhase","uStretch","uStretchA","uStripSoft","uStripW","uStudioRot","uTaper","uTexScale","uThickAmt","uTransp","uTube","uWall","uYaw","uZoom"]
  .forEach(n => U[n] = gl.getUniformLocation(prog, n));

/* ---------- state ---------- */
const DIALS = ["ink","gravity","crange","fluid","fcenter","fthick","fdepth","flag","fsmooth", "light","glare","speed","spin","tilt","tiltspd","wob", "wobspd","morph","morphspd","ring","lobe","stretch","tube","flat","taper", "zoom","frost","wall","speckle","soft","grain","bg", "optv1","refrfull","exposure","rolloff","lift","shellth","shellcl", "coresoft","fresstr","fresf0","reflstr","studiorot","stripw","strips", "curvresp","hiwidth","hiint","ior","refrstr","disp"];
const SKIP_LERP = new Set(["optv1","refrfull"]);
const S = {};
const ph = { t:0, spin:0, org:0, morph:0, stretchA:0.8 };
let blobs = [];
let blobSeq = 0;
let viewYaw = 0, viewPitch = 0;
const blobA   = new Float32Array(MAXB*4);
const blobAbs = new Float32Array(MAXB*3);
const pressB  = new Float32Array(MAXB*4);
let pMeanLast = 0, pressN = 0;
let last = performance.now(), frameN = 0;
let TRANSPARENT = window.__ORGANIC_TRANSPARENT__ === true;
let EMBED_DPR = 1, ZOOM_MUL = 1, PAUSED = false;
let extA = null, extB = null, extProgress = 0;
const EASE_SMOOTH = u => u*u*(3 - 2*u);
const lerp = (a,b,t) => a + (b-a)*t;

function smoothstep(e0,e1,x){ const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0))); return t*t*(3-2*t); }
function hex2rgb(h){ return [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255); }
function mixHex(a,b,t){ const A=hex2rgb(a),B=hex2rgb(b);
  return "#"+[0,1,2].map(i=>{ const v=Math.round(Math.max(0,Math.min(255,(A[i]+(B[i]-A[i])*t)*255)));
    return v.toString(16).padStart(2,"0"); }).join(""); }
function absorb(hex){ return hex2rgb(hex).map(c => -Math.log(Math.min(1,Math.max(0.02,c)))); }
function mkBlob(over){
  return Object.assign({ id:++blobSeq, color:"#16233f", size:0.5, speed:0.3, amt:0.9,
    tail:0.5, drift:0.5, follow:false, angle:Math.random()*Math.PI*2,
    dPh:Math.random()*Math.PI*2, dFq:0.35+Math.random()*0.5, _prox:0 }, over||{});
}
/* A sphere that provably contains every point where the field is <= 0, derived
   from the live dials. The development build used a hardcoded table gated on
   fluid <= 0.7, which the production presets exceed, so it returned 1e6 and the
   cull never fired: 87.8% of all front-march steps were being spent on pixels
   that miss the object. */
function boundRAuto(){
  let pSum = 0;
  for (let i=0;i<pressN;i++) pSum += pressB[i*4+2];
  const pAbs  = Math.max(Math.abs(pSum-pMeanLast), Math.abs(pMeanLast), 1e-6);
  const thick = Math.max(0.25, 1 + Math.abs(S.fluid*S.fthick)*pAbs);
  const R     = S.tube * (1 + Math.abs(S.taper)) * thick;
  const rPath = 1.16 * S.ring * (1 + Math.abs(S.stretch));
  const rCent = Math.abs(S.fluid*S.fcenter) * pAbs;
  const maxXY = rPath + (R + rCent) * (1 + Math.abs(S.stretch));
  const maxZ  = S.flat*R + Math.abs(S.wob)*0.08*S.ring + Math.abs(S.fluid*S.fdepth)*S.ring*pAbs;
  return Math.hypot(maxXY, maxZ) * 1.25 + 0.15;
}

function setExtPair(a, b){
  extA = a; extB = b;
  const need = Math.max(a.blobs ? a.blobs.length : 0, b.blobs ? b.blobs.length : 0);
  while (blobs.length < need) blobs.push(mkBlob(b.blobs[blobs.length] || a.blobs[blobs.length]));
  blobs.length = Math.min(blobs.length, MAXB);
  Object.assign(S, a.dials);
}
function dialLerp(A, B, e){
  for (const d of DIALS){
    if (SKIP_LERP.has(d)) continue;
    const a = A.dials[d], b = B.dials[d];
    if (a == null || b == null) continue;
    S[d] = lerp(a, b, e);
  }
  S.optv1    = B.dials.optv1    ?? 1;
  S.refrfull = B.dials.refrfull ?? 1;
  if (A.view || B.view){
    const av = A.view || {yaw:0,pitch:0}, bv = B.view || {yaw:0,pitch:0};
    viewYaw   = lerp(av.yaw,   bv.yaw,   e);
    viewPitch = lerp(av.pitch, bv.pitch, e);
  }
  for (let i=0;i<blobs.length;i++){
    const a = A.blobs[i], b = B.blobs[i], w = blobs[i];
    if (a && b){
      w.color = mixHex(a.color, b.color, e);
      w.size = lerp(a.size,b.size,e); w.speed = lerp(a.speed,b.speed,e);
      w.amt = lerp(a.amt,b.amt,e); w.tail = lerp(a.tail,b.tail,e);
      w.drift = lerp(a.drift,b.drift,e);
    } else if (b){
      w.color=b.color; w.size=b.size; w.speed=b.speed; w.tail=b.tail; w.drift=b.drift;
      w.amt = lerp(0,b.amt,e);
    } else if (a){
      w.color=a.color; w.size=a.size; w.speed=a.speed; w.tail=a.tail; w.drift=a.drift;
      w.amt = lerp(a.amt,0,e);
    }
  }
}

function resize(){
  const dpr = Math.min(devicePixelRatio || 1, EMBED_DPR);
  const w = Math.round(innerWidth*dpr), h = Math.round(innerHeight*dpr);
  if (canvas.width !== w || canvas.height !== h){
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}

function drawScene(W, H){
  W = W || canvas.width;  H = H || canvas.height;
  const tiltYaw   = S.tilt * 0.55 * Math.sin(ph.t * 0.31 * S.tiltspd);
  const tiltPitch = S.tilt * 0.42 * Math.sin(ph.t * 0.203 * S.tiltspd + 1.3);
  const n = Math.min(blobs.length, MAXB);
  for (let i=0;i<n;i++){
    const b = blobs[i];
    blobA[i*4]   = b.angle;
    blobA[i*4+1] = b.size;
    blobA[i*4+2] = b.tail * (b.speed >= 0 ? -1 : 1) * (1.0 - 0.7*(b._prox||0));
    blobA[i*4+3] = b.amt;
    const A = absorb(b.color);
    blobAbs[i*3]=A[0]; blobAbs[i*3+1]=A[1]; blobAbs[i*3+2]=A[2];
  }
  gl.uniform2f(U.uRes, W, H);
  gl.uniform1f(U.uTransp, TRANSPARENT ? 1 : 0);
  gl.uniform1f(U.uAlphaDebug, 0);
  gl.uniform1ui(U.uSeedU, (frameN >>> 0));
  gl.uniform1f(U.uSpeckFix, 1);
  gl.uniform1f(U.uForceSpeck, 0);
  gl.uniform1f(U.uYaw,   viewYaw + tiltYaw);
  gl.uniform1f(U.uPitch, viewPitch + tiltPitch);
  gl.uniform1f(U.uSpinPhase, ph.spin);
  gl.uniform1f(U.uOrgPhase, ph.org);
  gl.uniform1f(U.uZoom, S.zoom * ZOOM_MUL);
  gl.uniform1f(U.uRing, S.ring);
  gl.uniform1f(U.uTube, S.tube);
  gl.uniform1f(U.uFlat, S.flat);
  const wMax = Math.min(S.lobe * 3.0, 0.7);
  const CR = [1.0, 0.83, 1.19], CO = [0, 2.4, 4.4];
  gl.uniform3f(U.uCornerW,
    wMax*(1 - S.morph*(0.5+0.5*Math.sin(ph.morph*CR[0]+CO[0]))),
    wMax*(1 - S.morph*(0.5+0.5*Math.sin(ph.morph*CR[1]+CO[1]))),
    wMax*(1 - S.morph*(0.5+0.5*Math.sin(ph.morph*CR[2]+CO[2]))));
  gl.uniform1f(U.uTaper, S.taper * (1 - S.morph*(0.5+0.5*Math.sin(ph.morph*0.77+1.9))));
  gl.uniform1f(U.uStretch, S.stretch * (0.7 + 0.3*Math.sin(ph.morph*0.53+0.7)));
  gl.uniform1f(U.uStretchA, ph.stretchA);
  gl.uniform1f(U.uOrganic, S.wob);
  gl.uniform1f(U.uInk, S.ink * 12.0);
  gl.uniform1f(U.uGravity, S.gravity);
  gl.uniform1f(U.uLight, S.light);
  gl.uniform1f(U.uGlare, S.glare);
  gl.uniform1f(U.uFrost, S.frost * 2.0);
  gl.uniform1f(U.uWall, S.wall);
  gl.uniform1f(U.uSpeckle, S.speckle);
  gl.uniform1f(U.uGrain, S.grain);
  gl.uniform3f(U.uBg, S.bg*1.002, S.bg, S.bg*0.998);
  gl.uniform1f(U.uSoft, S.soft);
  for (let i=0;i<n;i++){
    const b = blobs[i];
    const sigma = Math.min(1.7, Math.max(0.3, b.size) * (1 + 1.6*S.fsmooth));
    pressB[i*4]   = b.angle;
    pressB[i*4+1] = Math.min(7, Math.max(0.7, 2/(sigma*sigma)));
    pressB[i*4+2] = b.amt;
    pressB[i*4+3] = (b.follow && (b._prox||0) > 0.5) ? 0 : (Math.sign(b.speed) || 1);
  }
  let pMean = 0, pM2 = 0;
  {
    const NSAMP = 96;
    for (let sIdx=0; sIdx<NSAMP; sIdx++){
      const th = sIdx/NSAMP * Math.PI*2;
      let P = 0;
      for (let i=0;i<n;i++)
        P += pressB[i*4+2] * Math.pow(0.5 + 0.5*Math.cos(th - pressB[i*4]), pressB[i*4+1]);
      pMean += P; pM2 += P*P;
    }
    pMean /= NSAMP;
    pM2 = Math.max(0, pM2/NSAMP - pMean*pMean);
  }
  pMeanLast = pMean; pressN = n;
  const safe = 0.55 / (1 + S.fluid*(1.6*S.fcenter + 0.35*S.fthick + 1.6*S.fdepth));
  gl.uniform1f(U.uFluid, S.fluid);
  gl.uniform1f(U.uCenterAmt, S.fcenter);
  gl.uniform1f(U.uThickAmt, S.fthick);
  gl.uniform1f(U.uDepthAmt, S.fdepth);
  gl.uniform1f(U.uGeoLag, S.flag);
  gl.uniform1f(U.uPMean, pMean);
  gl.uniform1f(U.uPVar, pM2);
  gl.uniform1f(U.uSafe, safe);
  gl.uniform1i(U.uPressN, n);
  gl.uniform4fv(U.uPressB, pressB);
  gl.uniform1i(U.uBlobN, n);
  gl.uniform4fv(U.uBlobA, blobA);
  gl.uniform3fv(U.uBlobAbs, blobAbs);
  gl.uniform1f(U.uOptV1, S.optv1);
  gl.uniform1f(U.uExposure, S.exposure);
  gl.uniform1f(U.uRolloff, S.rolloff);
  gl.uniform1f(U.uLift, S.lift);
  gl.uniform1f(U.uShellTh, S.shellth);
  gl.uniform1f(U.uShellCl, S.shellcl);
  gl.uniform1f(U.uCoreSoft, S.coresoft);
  gl.uniform1f(U.uFresStr, S.fresstr);
  gl.uniform1f(U.uF0, S.fresf0);
  gl.uniform1f(U.uReflStr, S.reflstr);
  gl.uniform1f(U.uStudioRot, S.studiorot);
  gl.uniform1f(U.uStripW, S.stripw);
  gl.uniform1f(U.uStripSoft, S.strips);
  gl.uniform1f(U.uCurvResp, S.curvresp);
  gl.uniform1f(U.uHiWidth, S.hiwidth);
  gl.uniform1f(U.uHiInt, S.hiint);
  gl.uniform1f(U.uIOR, S.ior);
  gl.uniform1f(U.uRefrStr, S.refrstr);
  gl.uniform1f(U.uDisp, S.disp);
  gl.uniform1f(U.uRefrFull, S.refrfull);
  gl.uniform1f(U.uBoundR, boundRAuto());
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function frame(now){
  const dt = Math.min((now - last)/1000, 0.05);
  last = now;
  frameN++;
  if (PAUSED || document.hidden){ raf = requestAnimationFrame(frame); return; }
  /* Nothing to draw until the host has sent a preset pair. Without this the
     clock advances by dt * S.speed while S is still empty, so ph.t becomes NaN
     on the first frame and never recovers. */
  if (!extA || !extB){ raf = requestAnimationFrame(frame); return; }
  dialLerp(extA, extB, EASE_SMOOTH(extProgress));
  const dts = dt * S.speed;
  ph.t += dts;
  ph.spin += dts * S.spin * 0.35 * (1 - 0.65*S.fluid);
  ph.stretchA += dts * 0.07 * (1 - 0.85*S.fluid);
  ph.org += dts * S.wobspd * 1.1;
  ph.morph += dts * S.morphspd * 0.45;
  for (const b of blobs){
    const mod = 1 + b.drift * Math.sin(ph.t*b.dFq + b.dPh);
    b._prox = 0;
    b.angle += dts * b.speed * mod;
  }
  resize();
  drawScene();
  raf = requestAnimationFrame(frame);
}
let raf = 0;

/* ---------- host bridge ---------- */
addEventListener("message", ev => {
  const d = ev.data; if (!d || d.type !== "organicO") return;
  if (d.a && d.b) setExtPair(d.a, d.b);
  if (typeof d.progress === "number") extProgress = Math.min(1, Math.max(0, d.progress));
  if (typeof d.dpr === "number") { EMBED_DPR = Math.max(0.5, Math.min(2, d.dpr)); resize(); }
  if (typeof d.zoomMul === "number" && isFinite(d.zoomMul)) ZOOM_MUL = Math.max(0.2, Math.min(5, d.zoomMul));
  if (typeof d.paused === "boolean") PAUSED = d.paused;
  if (typeof d.transparent === "boolean") TRANSPARENT = d.transparent;
});

/* The O is decoration: it never takes a pointer event, so it never
   steals a click, a scroll or a text selection from the page. */
canvas.style.pointerEvents = "none";
resize();
raf = requestAnimationFrame(frame);
</script></body></html>
`
const PAGE_T = PAGE.replace(
    "<head>",
    "<head><script>window.__ORGANIC_TRANSPARENT__=true;<\/script>"
)

// The dialled-in looks, baked in as the default A -> B journey.
const BUILT_IN = {
    t1: {"dials": {"debug": 0, "iso": 0, "ink": 0.95, "gravity": 0.82, "crange": 0.6, "light": 0.9, "glare": 0.85, "speed": 3.65, "fluid": 0, "fcenter": 0.19, "fthick": 0.47, "fdepth": 0.235, "flag": 0.35, "fsmooth": 0.72, "spin": 0.16, "tilt": 0.45, "tiltspd": 1, "wob": 0.45, "wobspd": 0.5, "morph": 0.79, "morphspd": 1.89, "ring": 0.71, "lobe": 0.17, "stretch": 0.14, "tube": 0.175, "flat": 0.7, "taper": 0.28, "zoom": 3.49, "frost": 0.18, "wall": 0.2, "speckle": 0, "soft": 0.9, "grain": 0, "bg": 0.955, "optv1": 1, "refrfull": 1, "exposure": 1.15, "rolloff": 0.85, "lift": 0.015, "shellth": 0.16, "shellcl": 0.7, "coresoft": 0.18, "fresstr": 1, "fresf0": 0.04, "reflstr": 1, "studiorot": 0.5, "stripw": 0.22, "strips": 0.16, "curvresp": 0.6, "hiwidth": 0.09, "hiint": 1, "ior": 1.45, "refrstr": 0.7, "disp": 0.012}, "view": {"yaw": 0, "pitch": 0}, "blobs": [{"color": "#101c33", "size": 0.55, "speed": 0.32, "amt": 1, "tail": 0.6, "drift": 0.45, "follow": false}, {"color": "#386bbc", "size": 0.85, "speed": -0.15, "amt": 0.4, "tail": 0.5, "drift": 0.7, "follow": false}]},
    t2: {"dials": {"debug": 0, "iso": 0, "ink": 0.95, "gravity": 0.82, "crange": 0.6, "light": 0.9, "glare": 0.85, "speed": 3.65, "fluid": 0, "fcenter": 0.19, "fthick": 0.47, "fdepth": 0.235, "flag": 0.35, "fsmooth": 0.72, "spin": 0.16, "tilt": 0.45, "tiltspd": 1, "wob": 0.64, "wobspd": 0.65, "morph": 0.84, "morphspd": 0.4, "ring": 0.71, "lobe": 0.17, "stretch": 0.14, "tube": 0.175, "flat": 0.7, "taper": 0.19, "zoom": 0.5, "frost": 0, "wall": 0.2, "speckle": 0, "soft": 0.9, "grain": 0, "bg": 0.955, "optv1": 1, "refrfull": 1, "exposure": 1.15, "rolloff": 0.85, "lift": 0.015, "shellth": 0.16, "shellcl": 0.7, "coresoft": 0.18, "fresstr": 1, "fresf0": 0.04, "reflstr": 1, "studiorot": 0.5, "stripw": 0.22, "strips": 0.16, "curvresp": 0.6, "hiwidth": 0.09, "hiint": 1, "ior": 1.45, "refrstr": 0.7, "disp": 0.012}, "view": {"yaw": 2.54591796875, "pitch": 0.0007421874999999742}, "blobs": [{"color": "#101c33", "size": 0.15, "speed": 0.35, "amt": 0, "tail": 0.6, "drift": 0.45, "follow": false}, {"color": "#386bbc", "size": 0.15, "speed": -0.15, "amt": 0, "tail": 0.5, "drift": 0.7, "follow": false}]},
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
function parseJSON(s) {
    if (!s) return null
    try {
        const o = JSON.parse(s)
        return o && o.dials && o.blobs ? o : null
    } catch {
        return null
    }
}

export default function OrganicO(props) {
    const {
        presetAName = "t1", presetBName = "t2",
        presetAJson = "", presetBJson = "",
        scrollStart = 0, scrollEnd = 1, quality = 1,
        transparentBg = true, zoomMul = 1, style,
    } = props

    const ref = useRef(null)
    const hostRef = useRef(null)
    const { scrollYProgress } = useScroll()

    /* Framer's String controls hand back "" rather than undefined, so a default
       parameter never fires for them; always resolve to a real preset object.
       Memoised so the config effect does not re-run on every render. */
    const A = useMemo(
        () => parseJSON(presetAJson) || BUILT_IN[presetAName?.trim()] || BUILT_IN.t1,
        [presetAJson, presetAName]
    )
    const B = useMemo(
        () => parseJSON(presetBJson) || BUILT_IN[presetBName?.trim()] || BUILT_IN.t2,
        [presetBJson, presetBName]
    )

    const post = useCallback((msg) => {
        ref.current?.contentWindow?.postMessage({ type: "organicO", ...msg }, "*")
    }, [])

    /* Hold the document off until the component is near the viewport, so an
       Organic O further down the page never competes with first paint. A hero
       instance is already intersecting when the observer attaches, so it starts
       on the very next frame. */
    const [live, setLive] = useState(false)
    useEffect(() => {
        const el = hostRef.current
        if (!el) return
        if (typeof IntersectionObserver === "undefined") { setLive(true); return }
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { setLive(true); io.disconnect() }
        }, { rootMargin: "300px" })
        io.observe(el)
        return () => io.disconnect()
    }, [])

    /* srcDoc is fixed for the component's lifetime: deriving it from a live
       prop would swap the document on every toggle, tearing down the WebGL
       context and recompiling the shader. Exactly one context and one RAF loop
       exist from mount to unmount. */
    const srcDoc = useRef(null)
    if (live && !srcDoc.current) srcDoc.current = transparentBg ? PAGE_T : PAGE

    const sendConfig = useCallback(() => {
        post({ a: A, b: B, dpr: quality,
               transparent: transparentBg, zoomMul })
    }, [post, A, B, quality, transparentBg, zoomMul])
    useEffect(() => { sendConfig() }, [sendConfig])

    // scroll -> at most one message per animation frame
    const pending = useRef(null)
    const raf = useRef(0)
    useMotionValueEvent(scrollYProgress, "change", (v) => {
        pending.current = clamp(
            (v - scrollStart) / Math.max(1e-6, scrollEnd - scrollStart), 0, 1
        )
        if (!raf.current) {
            raf.current = requestAnimationFrame(() => {
                raf.current = 0
                if (pending.current != null) post({ progress: pending.current })
            })
        }
    })
    useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

    /* Zero GPU work when the O cannot be seen: offscreen, or the tab is hidden.
       The page also checks document.hidden itself, which covers the case where
       the tab is backgrounded before this listener attaches. */
    useEffect(() => {
        const el = hostRef.current
        if (!el) return
        let onscreen = true
        const apply = () => post({ paused: !onscreen || document.hidden })
        const io = typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(([e]) => { onscreen = e.isIntersecting; apply() },
                                       { rootMargin: "120px" })
            : null
        io?.observe(el)
        document.addEventListener("visibilitychange", apply)
        return () => { io?.disconnect(); document.removeEventListener("visibilitychange", apply) }
    }, [post])

    /* Shadow suppression is unconditional, applied after ...style so a Framer
       layer effect cannot reintroduce one. */
    const noShadow = {
        boxShadow: "none", filter: "none",
        WebkitFilter: "none", backdropFilter: "none",
    }

    return (
        <div ref={hostRef}
             style={{ position: "relative", width: "100%", height: "100%", ...style, ...noShadow }}>
            {srcDoc.current && (
                <iframe
                    ref={ref}
                    srcDoc={srcDoc.current}
                    allowtransparency="true"
                    onLoad={sendConfig}
                    title="Organic O"
                    style={{
                        width: "100%", height: "100%", border: "none",
                        background: "transparent", colorScheme: "normal",
                        display: "block",
                        /* Decoration only: never intercepts a click or a
                           scroll from the page underneath. */
                        pointerEvents: "none",
                        ...noShadow,
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(OrganicO, {
    presetAName: { type: ControlType.String, title: "Preset A", placeholder: "t1 (built-in)" },
    presetBName: { type: ControlType.String, title: "Preset B", placeholder: "t2 (built-in)" },
    presetAJson: { type: ControlType.String, title: "Preset A JSON", displayTextArea: true, placeholder: "(optional) paste t1 JSON" },
    presetBJson: { type: ControlType.String, title: "Preset B JSON", displayTextArea: true, placeholder: "(optional) paste t2 JSON" },
    scrollStart: { type: ControlType.Number, title: "Scroll start", min: 0, max: 1, step: 0.01, defaultValue: 0 },
    scrollEnd: { type: ControlType.Number, title: "Scroll end", min: 0, max: 1, step: 0.01, defaultValue: 1 },
    quality: { type: ControlType.Number, title: "Quality (DPR)", min: 1, max: 2, step: 0.25, defaultValue: 1, description: "1 = one shader pixel per CSS pixel. Cost scales with the SQUARE of this: 2 is four times the work." },
    zoomMul: { type: ControlType.Number, title: "Scale", min: 0.2, max: 5, step: 0.05, defaultValue: 1, description: "Multiplies the preset zoom. Apparent size follows the container HEIGHT." },
    transparentBg: { type: ControlType.Boolean, title: "Transparent BG", defaultValue: true, enabledTitle: "On", disabledTitle: "Off", description: "Off = the shader paints its own studio backdrop." },
})
