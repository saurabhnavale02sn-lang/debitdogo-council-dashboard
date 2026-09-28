// The conductor: which shots are on screen at time t, how they transition,
// where the camera hits land, and how the post chain responds.

import { C, W, H, BEAT, BAR, lin } from './config.js';
import { ease, sat, hit, noise2, mix, remap } from './math.js';
import { camMatrix } from './engine.js';
import { drawHud } from './hud.js';
import { TILEFLIP, DUOTONE, GLITCH } from './transitions.js';
import * as ignition from './scenes/ignition.js';
import * as type from './scenes/type.js';
import * as geometry from './scenes/geometry.js';
import * as particles from './scenes/particles.js';
import * as dimension from './scenes/dimension.js';
import * as data from './scenes/data.js';
import * as montage from './scenes/montage.js';
import * as signature from './scenes/signature.js';
import { P } from './profile.js';

export const SHOTS = [
  { no: 1, name: 'IGNITION', t0: 0, hud: C.paper, accent: C.flame },
  { no: 2, name: 'KINETIC TYPE', t0: BAR, hud: C.ink, accent: C.paper },
  { no: 3, name: 'GEOMETRY', t0: 2 * BAR, hud: C.paper, accent: C.flame },
  { no: 4, name: 'PARTICLES', t0: 3 * BAR, hud: C.paper, accent: C.flame },
  { no: 5, name: 'DIMENSION', t0: 4 * BAR, hud: C.paper, accent: C.flame },
  { no: 6, name: 'DATA', t0: 5 * BAR, hud: C.ink, accent: C.flame },
  { no: 7, name: 'MONTAGE', t0: 6 * BAR, hud: C.paper, accent: C.flame },
  { no: 8, name: 'SIGNATURE', t0: 7 * BAR, hud: C.paper, accent: C.flame },
];

// Camera impacts: [time, strength]
const IMPACTS = [
  [BAR, 1.0],
  [2 * BAR, 0.5],
  [3 * BAR, 1.0],
  [4 * BAR, 0.7],
  [5 * BAR, 0.6],
  [6 * BAR, 0.9],
  [7 * BAR, 1.3],
];

const FLIP = { t0: 2 * BAR - 0.26, step: 0.026, dur: 0.24 };
FLIP.t1 = FLIP.t0 + (geometry.COLS - 1 + geometry.ROWS - 1) * FLIP.step + FLIP.dur;

let E, R, PG; // engine, resources, shader programs

export async function init(engine, res) {
  E = engine;
  R = res;
  SHOTS.forEach((s, i) => (s.name = P.shots[i]));
  PG = {
    tileflip: E.g.program('tileflip', TILEFLIP),
    blob: E.g.program('blob', dimension.BLOB),
    duotone: E.g.program('duotone', DUOTONE),
    glitch: E.g.program('glitch', GLITCH),
  };
  ignition.init(R);
  type.init(R);
  geometry.init(R);
  particles.init(R);
  dimension.init(R);
  data.init(R);
  montage.init(R);
  signature.init(R);
}

function shotAt(T) {
  let s = SHOTS[0];
  for (const x of SHOTS) if (T >= x.t0 - 1e-6) s = x;
  return s;
}

function placeholder(ctx, t) {
  const s = shotAt(t);
  ctx.fillStyle = C.ink2;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.paper;
  ctx.font = '700 64px JBMono';
  ctx.textAlign = 'center';
  ctx.fillText(`${s.no} ${s.name}`, W / 2, H / 2);
}

// Returns an opaque Layer or render target holding the frame at time t.
export function composite(E, t, T) {
  if (t < BAR) {
    const L = E.layer();
    const info = ignition.draw(L.ctx, t);
    if (info.portal) {
      L.ctx.save();
      L.ctx.clip(info.portal);
      type.draw(L.ctx, t);
      L.ctx.restore();
    }
    return L;
  }
  if (t < FLIP.t0) {
    const L = E.layer();
    type.draw(L.ctx, t);
    return L;
  }
  if (t < FLIP.t1) {
    const A = E.layer();
    type.draw(A.ctx, t);
    const B = E.layer();
    geometry.draw(B.ctx, t);
    const out = E.rt();
    E.shader(PG.tileflip, {
      uA: A.upload(), uB: B.upload(), uTime: t, uT0: FLIP.t0, uStep: FLIP.step, uDur: FLIP.dur, uGap: lin(C.ink),
    }, out, null);
    return out;
  }
  if (t < 3 * BAR) {
    const L = E.layer();
    geometry.draw(L.ctx, t);
    return L;
  }
  if (t < 4 * BAR) {
    const L = E.layer();
    particles.draw(L.ctx, t, { caption: true });
    return L;
  }
  if (t < 5 * BAR) {
    const out = blobFrame(E, t, { lower: true });
    if (t > data.T0 - 0.32) {
      const L = E.layer();
      data.drawWipe(L.ctx, t);
      E.drawLayer(L, out);
    }
    return out;
  }
  if (t < 6 * BAR) {
    const L = E.layer();
    data.draw(L.ctx, t);
    return glitchIn(E, L, t - data.T0 + 1, 0);
  }
  if (t < 7 * BAR) return montageFrame(E, t);
  const L = E.layer();
  signature.draw(L.ctx, t);
  return L;
}

const toRgb01 = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function asRT(E, src) {
  if (!src.canvas) return src;
  const rt = E.rt();
  E.clear(rt, [0, 0, 0, 0]);
  E.drawLayer(src, rt);
  return rt;
}

// Glitch the first few frames after a hard cut.
function glitchIn(E, src, u, seed) {
  const amt = Math.max(0, 1 - u / 0.06);
  if (amt <= 0) return src;
  const rt = asRT(E, src);
  const out = E.rt();
  E.shader(PG.glitch, { uTex: rt.tex, uAmt: amt, uSeed: seed + Math.floor(u * 60) * 1.7 }, out, null);
  return out;
}

function duotone(E, src, [dark, light]) {
  const rt = asRT(E, src);
  const out = E.rt();
  E.shader(PG.duotone, { uTex: rt.tex, uDark: toRgb01(dark), uLight: toRgb01(light) }, out, null);
  return out;
}

function montageFrame(E, t) {
  const c = montage.cutAt(t);
  let src;
  if (c.kind === 'blob') {
    src = duotone(E, blobFrame(E, c.opt.at + c.u), c.opt.duo);
  } else if (c.kind === 'particles') {
    const L = E.layer();
    particles.draw(L.ctx, c.opt.at + c.u);
    src = duotone(E, L, c.opt.duo);
  } else {
    const L = E.layer();
    if (c.kind === 'word') montage.drawWord(L.ctx, t, c);
    else if (c.kind === 'grid') montage.drawGrid(L.ctx, t, c);
    else if (c.kind === 'type') montage.drawType(L.ctx, t, c);
    else montage.drawPoint(L.ctx, t);
    src = L;
  }
  return c.kind === 'point' ? src : glitchIn(E, src, c.u, c.k * 13.1);
}

function blobFrame(E, t, { lower = false } = {}) {
  const back = E.layer();
  dimension.drawRing(back.ctx, t, false);
  const front = E.layer();
  dimension.drawRing(front.ctx, t, true);
  if (lower) dimension.drawLower(front.ctx, t);
  const out = E.rt();
  E.shader(PG.blob, { ...dimension.uniforms(t), uBack: back.upload(), uFront: front.upload() }, out, null);
  return out;
}

export function camera(t) {
  let shake = 0, punch = 0;
  for (const [t0, s] of IMPACTS) {
    const h = hit(t, t0, 0.11);
    shake += s * h;
    punch += s * hit(t, t0, 0.2);
  }
  const dx = shake * 16 * noise2(t * 38, 1.3);
  const dy = shake * 16 * noise2(t * 38, 7.9);
  const zoom = 1 + 0.028 * punch + Math.abs(shake) * 0.02;
  return camMatrix({ zoom, dx, dy, rot: shake * 0.006 * noise2(t * 20, 3.1) });
}

export function samples(T) {
  if (T > ignition.tZoom - 0.05 && T < BAR + 0.1) return 14; // the dive
  if (T > BAR - 0.02 && T < BAR + 0.45) return 12; // falling letters
  if (T >= 4 * BAR && T < 5 * BAR - 0.35) return 5; // slow chrome, expensive
  if (T >= 6 * BAR && T < 7 * BAR) return 6; // montage cuts
  return 8;
}

export const shutter = () => 0.5;

// Hard edits. The shutter never exposes across one: a frame's sub-frames are
// clamped to the side of the cut the frame belongs to.
export const CUTS = [4 * BAR, 6 * BAR, ...montage.CUTS.slice(1).map((c) => 6 * BAR + c[0]), 7 * BAR];

export function shutterWindow(T, half) {
  let lo = T - half, hi = T + half;
  for (const c of CUTS) {
    if (c > lo && c <= hi) {
      if (T >= c - 1e-9) lo = c;
      else hi = c - 1e-5;
    }
  }
  return [lo, hi];
}

export function post(T) {
  let ca = 0.0012;
  for (const [t0, s] of IMPACTS) ca += 0.006 * s * hit(T, t0, 0.12);
  const s = shotAt(T);
  const dark = s.no === 1 || s.no === 4 || s.no === 5 || s.no === 8 || (s.no === 7 && montage.cutAt(T).kind === 'point');
  let bloom = dark ? 0.28 : 0.0, threshold = 0.9;
  if (s.no === 4) { bloom = 0.55; threshold = 0.45; }
  if (s.no === 5) { bloom = 0.45; threshold = 0.85; }
  // white-hot flash frames on the chrome reveal and the final downbeat
  // discrete 2-frame punch on the first frame of the new shot
  const flashAt = (t0, amp) => {
    const k = Math.floor((T - t0) * 60 + 1e-6);
    return k >= 0 && k < 2 ? amp * [1, 0.25][k] : 0;
  };
  const fl = flashAt(4 * BAR, 0.7) + flashAt(7 * BAR, 0.8);
  return { ca, bloom, threshold, grain: 0.032, vignette: dark ? 0.32 : 0.18, flash: [...lin(C.paper), Math.min(fl, 0.85)] };
}

// Chips behind HUD labels on busy footage.
function hudChips(T) {
  const s = shotAt(T);
  if (s.no === 3 || s.no === 4) return 1;
  if (s.no === 7) {
    const k = montage.cutAt(T).kind;
    return k === 'grid' || k === 'particles' ? 1 : 0;
  }
  return 0;
}

function hudAccent(T) {
  const s = shotAt(T);
  if (s.no === 7) {
    const c = montage.cutAt(T);
    if (c.kind === 'type' || c.kind === 'word') return c.opt.bg === C.flame ? C.paper : C.flame;
    if (c.kind === 'particles') return C.ink;
  }
  return s.accent;
}

function hudColor(T) {
  const s = shotAt(T);
  if (s.no === 5 && T > data.T0 - 0.2) return C.paper;
  if (s.no !== 7) return s.hud;
  const c = montage.cutAt(T);
  if (c.kind === 'type' || c.kind === 'word') {
    const bg = c.opt.bg;
    return bg === C.paper || bg === C.sun ? C.ink : C.paper;
  }
  if (c.kind === 'particles') return C.ink;
  return C.paper;
}

export function hud(E, T) {
  const s = shotAt(T);
  const chips = hudChips(T);
  return drawHud(E.hud, T, {
    color: chips ? C.paper : hudColor(T), accent: hudAccent(T), alpha: 0.85, shot: s, chips,
  });
}
