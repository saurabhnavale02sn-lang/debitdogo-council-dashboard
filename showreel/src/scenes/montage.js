// 07 — MONTAGE.  The build: recaps on 8th notes in new colourways, then the
// word cycles through six typographic voices on 16ths, then silence — the
// point from frame one, alone on black, winding up for the last downbeat.

import { C, W, H, BEAT, BAR } from '../config.js';
import { ease, sat, mix, spring } from '../math.js';
import { run, glyph, strokeGlyph } from '../draw.js';
import * as geometry from './geometry.js';
import * as signature from './signature.js';

export const T0 = 6 * BAR; // 11.25
let R;
const E8 = BEAT / 2;
const E16 = BEAT / 4;

export function init(res) {
  R = res;
}

// Cut list: [start (local), kind, options]
export const CUTS = [
  [0, 'word', { bg: C.cobalt, fg: C.paper, dot: C.flame, mode: 'breathe' }],
  [E8, 'grid', { pal: { ink: C.cobalt, paper: C.paper, flame: C.sun, cobalt: C.ink, sun: C.flame }, at: 2 * BAR + BEAT - 0.08 }],
  [2 * E8, 'particles', { duo: [C.flame, C.paper], at: 3 * BAR + 0.16 }],
  [3 * E8, 'blob', { duo: [C.ink, C.sun], at: 4 * BAR + 1.05 }],
  [BEAT * 2 + 0 * E16, 'type', { style: 'condensed', bg: C.sun, fg: C.ink }],
  [BEAT * 2 + 1 * E16, 'type', { style: 'serif', bg: C.cobalt, fg: C.paper }],
  [BEAT * 2 + 2 * E16, 'type', { style: 'outline', bg: C.ink, fg: C.flame }],
  [BEAT * 2 + 3 * E16, 'type', { style: 'hairline', bg: C.paper, fg: C.ink }],
  [BEAT * 3 + 0 * E16, 'type', { style: 'wide', bg: C.flame, fg: C.paper }],
  [BEAT * 3 + 1 * E16, 'type', { style: 'stack', bg: C.paper, fg: C.cobalt }],
  [BEAT * 3 + 2 * E16, 'point', {}],
];

export function cutAt(t) {
  const tau = t - T0;
  let k = 0;
  for (let i = 0; i < CUTS.length; i++) if (tau >= CUTS[i][0] - 1e-6) k = i;
  const [start, kind, opt] = CUTS[k];
  const end = k + 1 < CUTS.length ? CUTS[k + 1][0] : BAR;
  return { k, kind, opt, u: tau - start, dur: end - start };
}

function wordAt(ctx, text, font, size, opts, cx, cy, style) {
  const r = run(font, text, { size, ...opts });
  const x0 = cx - r.width / 2;
  const base = cy + (font === R.serif ? r.xh : r.cap) / 2;
  for (const g of r.glyphs) {
    ctx.save();
    ctx.translate(x0 + g.px, base);
    if (style === 'outline') strokeGlyph(ctx, font, g.g, size, 3);
    else glyph(ctx, font, g.g, size);
    ctx.restore();
  }
  return r;
}

export function drawType(ctx, t, c) {
  const { opt, u, dur } = c;
  ctx.fillStyle = opt.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = opt.fg;
  ctx.strokeStyle = opt.fg;
  const p = sat(u / dur);
  const cx = W / 2, cy = H / 2;
  const f = R.flex;
  switch (opt.style) {
    case 'condensed':
      wordAt(ctx, 'MOTION', f, 620, { wght: 1000, wdth: 25 + 10 * p }, cx, cy);
      break;
    case 'serif':
      wordAt(ctx, 'motion', R.serif, 470 + 40 * p, {}, cx, cy - 30);
      break;
    case 'outline':
      wordAt(ctx, 'MOTION', f, 330 + 30 * p, { wght: 900, wdth: 140 }, cx, cy, 'outline');
      break;
    case 'hairline':
      wordAt(ctx, 'MOTION', f, 300, { wght: 100, wdth: 151, tracking: 0.08 + 0.05 * p }, cx, cy);
      break;
    case 'wide': {
      wordAt(ctx, 'MOTION', f, 520 + 60 * p, { wght: 1000, wdth: 151 }, cx, cy);
      break;
    }
    case 'stack': {
      for (let i = -2; i <= 2; i++) {
        ctx.globalAlpha = i === 0 ? 1 : 0.28;
        const y = cy + i * 190 - p * 190 * Math.sign(i || 1) * 0.15;
        wordAt(ctx, 'MOTION', f, 200, { wght: 850, wdth: 120 }, cx, y);
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

export function drawWord(ctx, t, c) {
  const { opt, u } = c;
  ctx.fillStyle = opt.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = opt.fg;
  const f = R.flex;
  const w = 25 + 126 * (0.5 - 0.5 * Math.cos(u * 22));
  const r = wordAt(ctx, 'MOTION', f, 330, { wght: 1000, style: (i) => ({ wdth: mix(w, 151 - w + 25, i / 5) }) }, W / 2, H / 2);
  ctx.fillStyle = opt.dot;
  ctx.beginPath();
  ctx.arc(W / 2 + r.width / 2 + 40, H / 2 + r.cap / 2 - 26, 26, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPoint(ctx, t) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  const d = signature.dotState(t);
  const tau = t - T0;
  const intro = spring(tau - (BEAT * 3 + 2 * E16), 3.4, 0.4);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.sx * intro, d.sy * intro);
  ctx.fillStyle = C.flame;
  ctx.beginPath();
  ctx.arc(0, 0, d.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGrid(ctx, t, c) {
  geometry.draw(ctx, c.opt.at + c.u * 0.9, { pal: { ...C, ...c.opt.pal } });
}
