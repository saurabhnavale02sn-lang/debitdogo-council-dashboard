// 04 — PARTICLES.  Every collapsed tile bursts into its own colours, the
// debris is caught by a curl-noise flow field, then everything is pulled
// onto a rotating 3D sphere — which the next shot turns into chrome.
//
// The simulation is precomputed at fixed 240 Hz steps so any sub-frame time
// can be sampled deterministically (motion blur, parallel render chunks).

import { C, W, H, BEAT, BAR, hexToRgb } from '../config.js';
import { ease, sat, mix, mulberry32, curl2 } from '../math.js';
import * as geometry from './geometry.js';

export const T0 = 3 * BAR; // 5.625
const T1 = 4 * BAR + 0.05;
const DT = 1 / 240;
const STEPS = Math.ceil((T1 - T0) / DT) + 2;
const PER_TILE = 500;
export const SPHERE = { cx: W / 2, cy: H / 2, r: 300, f: 1469.7, d: 5 }; // matches the blob camera
// The type ring of the next shot. One particle in six leaves the sphere to
// orbit on this exact path, so the dotted ring becomes letters at the cut.
export const RING = { r: 1.78, pitch: 0.34 };
export const ringPhase = (t) => -0.62 * (t - 4 * BAR) - 1.2;

let N = 0;
let traj; // Float32Array [step][i][x,y,vx,vy]
let colIdx, sizes, sph; // sphere points (unit)
let ringIdx, NR = 0;
const PALETTE = [];

function particleColor(name) {
  if (name === 'ink') return 'paper';
  return name;
}

export function init() {
  const tiles = geometry.tiles;
  N = tiles.length * PER_TILE;
  const rnd = mulberry32(4242);
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  colIdx = new Uint8Array(N);
  sizes = new Float32Array(N);
  const names = ['paper', 'flame', 'cobalt', 'sun'];
  PALETTE.push(C.paper, C.flame, '#5B6CFF', C.sun);
  let i = 0;
  for (const tile of tiles) {
    const [px, py] = geometry.tileScreen(tile, T0);
    for (let k = 0; k < PER_TILE; k++, i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 4;
      x[i] = px + Math.cos(a) * r;
      y[i] = py + Math.sin(a) * r;
      const sp = 90 + 620 * Math.pow(rnd(), 2.2) + 140 * rnd();
      vx[i] = Math.cos(a) * sp;
      vy[i] = Math.sin(a) * sp;
      colIdx[i] = names.indexOf(particleColor(rnd() < 0.6 ? tile.fg : tile.bg));
      sizes[i] = 1.4 + 2.2 * Math.pow(rnd(), 2.5);
    }
  }
  // Fibonacci sphere targets, shuffled so neighbours come from all tiles.
  sph = new Float32Array(N * 3);
  const order = Array.from({ length: N }, (_, k) => k);
  for (let k = N - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  ringIdx = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) if (k % 6 === 0) ringIdx[order[k]] = NR++;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < N; k++) {
    const yy = 1 - (2 * (k + 0.5)) / N;
    const rr = Math.sqrt(1 - yy * yy);
    const th = ga * k;
    const o = order[k] * 3;
    sph[o] = Math.cos(th) * rr;
    sph[o + 1] = yy;
    sph[o + 2] = Math.sin(th) * rr;
  }
  // Integrate: velocities relax towards a galaxy-like field — differential
  // rotation, an inward drift modulated into two density-wave arms, plus a
  // little curl noise so the arms stay organic.
  traj = new Float32Array(STEPS * N * 4);
  const f = [0, 0];
  const drag = Math.exp(-3.4 * DT);
  for (let s = 0; s < STEPS; s++) {
    const t = T0 + s * DT;
    const base = s * N * 4;
    const settle = Math.min(1, (t - T0) / 0.35);
    const relax = 1 - Math.exp(-(0.6 + 2.4 * settle) * DT);
    for (let k = 0; k < N; k++) {
      const o = base + 4 * k;
      traj[o] = x[k];
      traj[o + 1] = y[k];
      traj[o + 2] = vx[k];
      traj[o + 3] = vy[k];
      const dx = x[k] - W / 2, dy = y[k] - H / 2;
      const r = Math.hypot(dx, dy) + 1e-3;
      const th = Math.atan2(dy, dx);
      const q = r / 320;
      const vt = 560 * q * Math.exp(1 - q) + 90;
      const arms = 1 + 0.75 * Math.sin(2 * th - r / 95 + (t - T0) * 1.3);
      const vr = -(70 + 150 * Math.min(r / 700, 1.4)) * arms;
      curl2(x[k] * 0.0021, y[k] * 0.0021, t * 0.4, f);
      const tx = (-dy / r) * vt + (dx / r) * vr + f[0] * 150;
      const ty = (dx / r) * vt + (dy / r) * vr + f[1] * 150;
      vx[k] = vx[k] * drag + (tx - vx[k] * drag) * relax;
      vy[k] = vy[k] * drag + (ty - vy[k] * drag) * relax;
      x[k] += vx[k] * DT;
      y[k] += vy[k] * DT;
    }
  }
}

// Sphere rotation used by both the particles and the chrome blob.
export function sphereRot(t) {
  return { yaw: 0.9 * (t - T0), pitch: 0.38 };
}

// Project a ring slot j at time t -> [x, y, depthScale, z]
function ringPoint(j, t, out) {
  const phi = ringPhase(t) + (j / NR) * Math.PI * 2;
  const x = RING.r * Math.sin(phi), z = RING.r * Math.cos(phi);
  const cp = Math.cos(RING.pitch), sp = Math.sin(RING.pitch);
  const y1 = -sp * z, z1 = cp * z;
  const depth = SPHERE.d - z1;
  const s = SPHERE.f / depth;
  out[0] = SPHERE.cx + x * s;
  out[1] = SPHERE.cy - y1 * s;
  out[2] = s / (SPHERE.f / SPHERE.d);
  out[3] = z1;
  return out;
}

// Project sphere point k at time t -> [x, y, depthScale, z]
function spherePoint(k, t, out) {
  const { yaw, pitch } = sphereRot(t);
  const o = k * 3;
  let px = sph[o], py = sph[o + 1], pz = sph[o + 2];
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let x1 = cy * px + sy * pz;
  let z1 = -sy * px + cy * pz;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y1 = cp * py - sp * z1;
  const z2 = sp * py + cp * z1;
  // camera at z = d looking down -z; sphere radius 1 at origin
  const depth = SPHERE.d - z2;
  const s = SPHERE.f / depth;
  out[0] = SPHERE.cx + x1 * s;
  out[1] = SPHERE.cy - y1 * s;
  out[2] = s / (SPHERE.f / SPHERE.d);
  out[3] = z2;
  return out;
}

export function draw(ctx, t, { bg = true } = {}) {
  const tau = t - T0;
  if (bg) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, W, H);
    // a faint cobalt nebula behind the core
    const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 620);
    const a = 0.22 * sat(tau / 0.5);
    gr.addColorStop(0, `rgba(43,68,255,${a})`);
    gr.addColorStop(1, 'rgba(43,68,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }
  const u = Math.max(0, tau / DT);
  const s0 = Math.min(Math.floor(u), STEPS - 2);
  const fr = Math.min(u - s0, 1);
  const A = s0 * N * 4, B = (s0 + 1) * N * 4;
  // gather onto the sphere from beat 2, fully formed by beat 3.5
  const g = ease.inOutCubic(sat((t - (T0 + 1.85 * BEAT)) / (1.55 * BEAT)));
  const pt = [0, 0, 0, 0];
  const pt2 = [0, 0, 0, 0];
  const batches = PALETTE.map(() => [[], []]); // [front, back] per colour
  const streak = 0.022; // seconds of travel drawn as a streak
  for (let k = 0; k < N; k++) {
    const o = 4 * k;
    let x = traj[A + o] + (traj[B + o] - traj[A + o]) * fr;
    let y = traj[A + o + 1] + (traj[B + o + 1] - traj[A + o + 1]) * fr;
    let vx = traj[A + o + 2] + (traj[B + o + 2] - traj[A + o + 2]) * fr;
    let vy = traj[A + o + 3] + (traj[B + o + 3] - traj[A + o + 3]) * fr;
    let sz = sizes[k];
    let back = 0;
    if (g > 0) {
      if (ringIdx[k] >= 0) {
        ringPoint(ringIdx[k], t, pt);
        ringPoint(ringIdx[k], t - streak, pt2);
      } else {
        spherePoint(k, t, pt);
        spherePoint(k, t - streak, pt2);
      }
      const gk = sat(g * 1.25 - ((k % 97) / 97) * 0.25);
      const e = ease.inOutCubic(gk);
      x = mix(x, pt[0], e);
      y = mix(y, pt[1], e);
      vx = mix(vx, (pt[0] - pt2[0]) / streak, e);
      vy = mix(vy, (pt[1] - pt2[1]) / streak, e);
      sz = mix(sz, 0.9 + 1.3 * pt[2] * pt[2], e);
      back = pt[3] < 0 ? e : 0;
    }
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    batches[colIdx[k]][back > 0.5 ? 1 : 0].push(x, y, vx * streak, vy * streak, sz);
  }
  const burst = Math.max(0, 1 - tau / 0.1);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let c = 0; c < PALETTE.length; c++) {
    for (let layer = 1; layer >= 0; layer--) {
      const arr = batches[c][layer];
      if (!arr.length) continue;
      ctx.globalAlpha = layer === 1 ? mix(0.35, 0.1, g) : mix(0.9, 0.42, g);
      ctx.strokeStyle = PALETTE[c];
      // bucket by size to keep a handful of strokes
      for (const [lo, hi, lw] of [[0, 1.9, 1.6], [1.9, 2.8, 2.4], [2.8, 99, 3.4]]) {
        ctx.lineWidth = lw * (1 + 1.5 * burst);
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 5) {
          const sz = arr[i + 4];
          if (sz < lo || sz >= hi) continue;
          ctx.moveTo(arr[i] - arr[i + 2], arr[i + 1] - arr[i + 3]);
          ctx.lineTo(arr[i] + 0.01, arr[i + 1]);
        }
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
