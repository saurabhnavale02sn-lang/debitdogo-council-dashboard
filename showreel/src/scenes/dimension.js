// 05 — DIMENSION.  The particle sphere becomes liquid chrome: a raymarched
// metaball with thin-film iridescence reflecting a procedural studio, while
// a ring of type orbits it in true perspective (split into behind/in-front
// layers so the blob occludes it correctly).

import { C, W, H, BEAT, BAR, lin } from '../config.js';
import { ease, sat, mix, hit, spring } from '../math.js';
import { GLSL_HEAD } from '../gl.js';
import { run, lowerThird } from '../draw.js';
import { P } from '../profile.js';
import { SPHERE, sphereRot, RING, ringPhase } from './particles.js';

export const T0 = 4 * BAR; // 7.5
let R, ringRun, ringScale;

export function init(res) {
  R = res;
  ringRun = run(R.flex, P.dimension.ring, { size: 1, wght: 760, wdth: 112, tracking: 0.08 });
  // scale so the text wraps exactly once around the ring
  ringScale = (2 * Math.PI * RING.r) / ringRun.width;
}

export function focal(t) {
  const p = ease.inOutCubic(sat((t - T0) / BAR));
  return SPHERE.f * (1 + 0.12 * p);
}

// Shared by shader + ring: satellite blobs (xyz, radius).
export function satellites(t) {
  const tau = Math.max(0, t - T0);
  const out = [];
  const defs = [
    [0.9, 0.0, 0.62, 0.3, 1.1],
    [-1.3, 1.6, 0.9, 0.24, 2.3],
    [1.7, 3.1, -0.55, 0.2, 3.6],
    [-0.7, 4.4, 1.25, 0.17, 0.4],
  ];
  const emerge = ease.outCubic(sat((tau - 0.18) / 0.8));
  for (const [w, ph, tilt, r, f] of defs) {
    const a = w * tau + ph;
    const dist = mix(0.2, 0.92 + 0.28 * (0.5 - 0.5 * Math.cos(f * tau * 0.9 + ph)), emerge);
    let x = Math.cos(a) * dist, y = 0, z = Math.sin(a) * dist;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const y2 = ct * y - st * z, z2 = st * y + ct * z;
    out.push(x, y2, z2, r * mix(0.5, 1, emerge));
  }
  return out;
}

export const BLOB = GLSL_HEAD + `
uniform float uTau;
uniform float uF;
uniform float uPulse;
uniform float uMorph;
uniform vec2 uRot;          // yaw, pitch
uniform vec4 uSat[4];
uniform sampler2D uBack;
uniform sampler2D uFront;
uniform vec3 uInk;
uniform vec3 uFlame;
uniform vec3 uCobalt;
uniform vec3 uPaper;
uniform vec3 uSun;
uniform float uRingPitch;

const vec3 CAM = vec3(0.0, 0.0, 5.0);
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

mat3 OBJ;
float map(vec3 p) {
  vec3 q = OBJ * p;
  float d = length(q) - 1.0;
  float w = uMorph * (0.035 + 0.05 * uPulse);
  d += w * sin(3.1 * q.x + 1.7 * uTau) * sin(2.9 * q.y - 1.3 * uTau) * sin(3.3 * q.z + 2.1 * uTau);
  d += uMorph * 0.012 * sin(7.0 * q.x + 4.0 * uTau) * sin(6.3 * q.y + 3.1 * uTau) * sin(6.7 * q.z - 2.7 * uTau);
  for (int i = 0; i < 4; i++) d = smin(d, length(p - uSat[i].xyz) - uSat[i].w, 0.5);
  return d;
}
vec3 normal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0015;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// Procedural studio: softboxes, a warm strip, a cobalt rim, the ring's glow.
vec3 env(vec3 r) {
  vec3 col = mix(uInk * 0.6, uInk * 2.4 + uCobalt * 0.03, smoothstep(-0.7, 0.9, r.y));
  // one wide overhead softbox with soft falloff, plus a faint sky
  float band = smoothstep(0.52, 0.6, r.y) * (1.0 - smoothstep(0.8, 0.9, r.y));
  float wide = 1.0 - smoothstep(0.34, 0.5, abs(r.x + 0.1 * r.z));
  col += vec3(1.2) * band * wide;
  col += vec3(0.3) * smoothstep(0.9, 1.0, r.y);
  float strip = smoothstep(0.1, 0.03, abs(r.x + 0.74)) * (1.0 - smoothstep(0.3, 0.55, abs(r.y - 0.05)));
  col += uFlame * 2.4 * strip;
  float strip2 = smoothstep(0.05, 0.015, abs(r.x - 0.62 + 0.2 * r.y)) * smoothstep(-0.2, 0.2, -r.z) * (1.0 - smoothstep(0.4, 0.6, abs(r.y)));
  col += uPaper * 1.3 * strip2;
  float rim = smoothstep(0.35, 0.95, r.x) * smoothstep(-0.1, 0.5, -r.z);
  col += uCobalt * 1.9 * rim;
  float floorGlow = smoothstep(-0.25, -0.6, r.y);
  col += uSun * 0.18 * floorGlow;
  // the type ring, seen in reflection as a thin warm band
  vec3 rn = vec3(0.0, cos(uRingPitch), sin(uRingPitch));
  col += uPaper * 0.9 * smoothstep(0.035, 0.0, abs(dot(r, rn))) * smoothstep(-0.2, 0.4, r.z + 0.3);
  return col;
}

// Thin-film colours drawn from the reel's palette: flame, magenta, cobalt, sun.
vec3 film(float x) {
  x = fract(x) * 4.0;
  vec3 m = vec3(1.0, 0.047, 0.4);
  float f = smoothstep(0.0, 1.0, fract(x));
  if (x < 1.0) return mix(uFlame, m, f);
  if (x < 2.0) return mix(m, uCobalt, f);
  if (x < 3.0) return mix(uCobalt, uSun, f);
  return mix(uSun, uFlame, f);
}

vec3 shade(vec3 p, vec3 n, vec3 v) {
  vec3 r = reflect(-v, n);
  float ct = clamp(dot(n, v), 0.0, 1.0);
  vec3 F0 = vec3(0.86, 0.84, 0.82);
  vec3 fres = F0 + (1.0 - F0) * pow(1.0 - ct, 5.0);
  vec3 q = OBJ * p;
  float filmT = 1.25 + 0.55 * sin(2.6 * q.y + 1.4 * uTau) + 0.35 * cos(2.1 * q.x - 0.9 * uTau) + 0.25 * sin(3.1 * q.z + uTau);
  vec3 irid = film(filmT * (1.15 - ct) * 0.85 + 0.07 * uTau);
  vec3 tint = mix(vec3(1.0), irid * 1.45, 0.62);
  vec3 c = env(r) * fres * tint;
  // cheap occlusion where blobs merge
  float ao = clamp(map(p + n * 0.12) / 0.12, 0.0, 1.0);
  c *= 0.55 + 0.45 * ao;
  return c;
}

vec4 over(vec4 top, vec4 bottom) { return top + bottom * (1.0 - top.a); }
vec4 layerTex(sampler2D s, vec2 uv) { vec4 c = texture(s, uv); return vec4(c.rgb * c.a, c.a); }

void main() {
  OBJ = rotX(uRot.y) * rotY(uRot.x);
  vec2 px = designPx(vUv);
  vec2 cc = (px - vec2(960.0, 540.0)) / 540.0;
  // backdrop: ink with a low cobalt bloom behind the form
  vec3 bg = uInk * (0.8 + 0.25 * smoothstep(1.6, 0.0, length(cc)));
  bg += uCobalt * 0.07 * exp(-dot(cc, cc) * 1.8);
  vec4 col = vec4(bg, 1.0);
  col = over(layerTex(uBack, vUv), col);

  vec3 rd = normalize(vec3((px.x - 960.0) / uF, -(px.y - 540.0) / uF, -1.0));
  vec3 ro = CAM;
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 2.6 * 2.6;
  float h = b * b - c;
  if (h > 0.0) {
    float t = max(-b - sqrt(h), 0.0);
    float tMax = -b + sqrt(h);
    float minD = 1e9, tMin = t;
    bool hitS = false;
    for (int i = 0; i < 96; i++) {
      vec3 p = ro + rd * t;
      float d = map(p);
      if (d < minD) { minD = d; tMin = t; }
      if (d < 0.0005 * t) { hitS = true; break; }
      t += d * 0.85;
      if (t > tMax) break;
    }
    float pxw = 1.3 * tMin / uF;          // pixel footprint at that depth
    float cov = hitS ? 1.0 : 1.0 - smoothstep(0.0, pxw, minD);
    if (cov > 0.0) {
      float tt = hitS ? t : tMin;
      vec3 p = ro + rd * tt;
      vec3 n = normal(p);
      vec3 s = shade(p, n, -rd);
      col = over(vec4(s * cov, cov), col);
    }
  }
  col = over(layerTex(uFront, vUv), col);
  outColor = vec4(col.rgb, 1.0);
}`;

// Lower third for the chrome shot (drawn on the front layer).
export function drawLower(ctx, t) {
  if (!P.dimension.lower) return;
  lowerThird(ctx, R, P.dimension.lower, t, T0 + 0.35, 5 * BAR - 0.3, { y: 178, bigSize: 112, bigFont: 'flex', panel: false });
}

// Draw the type ring glyphs on one side (front: z > 0). Each glyph gets the
// local affine of the perspective projection at its anchor, so it is
// foreshortened (and mirrored on the far side) like real geometry.
export function drawRing(ctx, t, front) {
  const tau = t - T0;
  const F = focal(t);
  // letters grow out of the particle ring (same path, same phase)
  const reveal = ease.outExpo(sat(tau / 0.5));
  const cp = Math.cos(RING.pitch), sp = Math.sin(RING.pitch);
  const tilt = (x, y, z) => [x, cp * y - sp * z, sp * y + cp * z];
  const proj = (p) => {
    const d = 5 - p[2];
    return [W / 2 + (F * p[0]) / d, H / 2 - (F * p[1]) / d];
  };
  const phi0 = ringPhase(t);
  const k = ringScale; // world units per em
  const fu = (k / R.flex.upm) * mix(0.12, 1, reveal); // world units per font unit
  const capW = R.flex.cap * fu;
  const r = RING.r;
  ctx.fillStyle = C.paper;
  const e = 0.01;
  for (const g of ringRun.glyphs) {
    if (g.ch === ' ') continue;
    const phi = phi0 + ((g.px + g.pw / 2) * k) / RING.r;
    const sn = Math.sin(phi), cs = Math.cos(phi);
    const P = tilt(r * sn, 0, r * cs);
    if ((P[2] > 0) !== front) continue;
    const T = tilt(cs, 0, -sn);
    const U = tilt(0, 1, 0);
    const S0 = proj(P);
    const Sx = proj([P[0] + T[0] * e, P[1] + T[1] * e, P[2] + T[2] * e]);
    const Sy = proj([P[0] + U[0] * e, P[1] + U[1] * e, P[2] + U[2] * e]);
    const jx = [(Sx[0] - S0[0]) / e, (Sx[1] - S0[1]) / e];
    const jy = [(Sy[0] - S0[0]) / e, (Sy[1] - S0[1]) / e];
    const half = (g.pw * k) / 2;
    const ox = S0[0] - jx[0] * half - jy[0] * (capW / 2);
    const oy = S0[1] - jx[1] * half - jy[1] * (capW / 2);
    const depth = (P[2] / r + 1) / 2;
    ctx.globalAlpha = front ? 0.96 : 0.14 + 0.3 * depth;
    ctx.save();
    ctx.transform(jx[0] * fu, jx[1] * fu, jy[0] * fu, jy[1] * fu, ox, oy);
    ctx.fill(R.flex.path(g.g));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function uniforms(t) {
  const tau = Math.max(0, t - T0);
  let pulse = 0;
  for (let k = 0; k < 5; k++) pulse += hit(tau, k * BEAT, 0.16);
  const rot = sphereRot(t);
  const sats = satellites(t);
  return {
    uTau: tau,
    uF: focal(t),
    uPulse: pulse,
    uMorph: ease.outCubic(sat(tau / 0.35)),
    uRot: [rot.yaw, rot.pitch],
    uSat: sats,
    uInk: lin(C.ink),
    uFlame: lin(C.flame),
    uCobalt: lin(C.cobalt),
    uPaper: lin(C.paper),
    uSun: lin(C.sun),
    uRingPitch: RING.pitch,
  };
}
