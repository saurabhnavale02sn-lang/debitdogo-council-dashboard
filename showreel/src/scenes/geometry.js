// 03 — GEOMETRY.  A modern-Bauhaus tile system. Every beat sends a wave
// through the grid: quarter turns, a radial colour inversion, a counter-turn,
// then every plane collapses back into a point — ready to burst into
// particles on the downbeat.

import { C, W, H, BEAT, BAR } from '../config.js';
import { ease, sat, mix, mulberry32, remap } from '../math.js';
import { run, glyph, mono } from '../draw.js';
import { P } from '../profile.js';

export const T0 = 2 * BAR; // 3.75
export const TS = 240;
export const ORG = [0, -60];
export const COLS = 8;
export const ROWS = 5;
const MOTIFS = ['quarter', 'circle', 'half', 'tri', 'stripes', 'rings', 'leaf', 'arch', 'dots', 'diamond'];
const FG = {
  paper: [['ink', 2], ['flame', 2], ['cobalt', 1]],
  ink: [['paper', 2], ['flame', 2], ['sun', 1]],
  flame: [['ink', 2], ['paper', 2]],
  cobalt: [['paper', 2], ['sun', 1]],
  sun: [['ink', 2], ['flame', 1]],
};

export const tiles = [];
let RES;

function pick(rnd, weighted) {
  let total = 0;
  for (const [, w] of weighted) total += w;
  let r = rnd() * total;
  for (const [v, w] of weighted) {
    r -= w;
    if (r <= 0) return v;
  }
  return weighted[weighted.length - 1][0];
}

export function init(res) {
  RES = res;
  const rnd = mulberry32(7);
  const BG = [['paper', 5], ['ink', 4], ['flame', 2], ['cobalt', 2], ['sun', 1]];
  const MOT = [['quarter', 4], ['circle', 3], ['half', 4], ['leaf', 2], ['tri', 2], ['arch', 2], ['rings', 1], ['stripes', 1], ['plain', 2]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let bg;
      do {
        bg = pick(rnd, BG);
      } while (
        (c > 0 && tiles[r * COLS + c - 1].bg === bg) ||
        (r > 0 && tiles[(r - 1) * COLS + c].bg === bg)
      );
      const fg = pick(rnd, FG[bg]);
      let m;
      do {
        m = pick(rnd, MOT);
      } while (c > 0 && tiles[r * COLS + c - 1].motif === m);
      tiles.push({
        c, r, bg, fg, motif: m,
        rot: Math.floor(rnd() * 4),
        cx: ORG[0] + (c + 0.5) * TS,
        cy: ORG[1] + (r + 0.5) * TS,
        seed: rnd(),
      });
    }
  }
  // Profile stat tiles replace a few motifs: a number, a label, no rotation.
  for (const st of P.geometry.stats) {
    const tile = tiles[st.r * COLS + st.c];
    Object.assign(tile, { motif: 'stat', bg: st.bg, fg: st.fg, stat: layoutStat(st) });
  }
}

// Fit a stat's value into the tile (width axis first, then size).
function layoutStat(st) {
  const maxW = 196;
  if (st.serif) {
    const lines = st.value.split(' ');
    let size = 92;
    for (const l of lines) size = Math.min(size, (maxW / run(RES.serif, l, { size: 100 }).width) * 100);
    return { ...st, lines: lines.map((l) => run(RES.serif, l, { size })), size };
  }
  const f = RES.flex;
  let size = 124;
  let wdth = f.fitWidth(st.value, (maxW / size) * f.upm, 900);
  let r = run(f, st.value, { size, wght: 900, wdth });
  if (r.width > maxW) {
    size *= maxW / r.width;
    r = run(f, st.value, { size, wght: 900, wdth });
  }
  return { ...st, lines: [r], size };
}

function statTile(ctx, stat, h, fgCol) {
  ctx.fillStyle = fgCol;
  if (stat.serif) {
    const lh = stat.size * 0.86;
    stat.lines.forEach((r, i) => {
      ctx.save();
      ctx.translate(-h + 20, -h + 26 + lh * (i + 1) - lh * 0.18);
      for (const g of r.glyphs) {
        ctx.save();
        ctx.translate(g.px, 0);
        glyph(ctx, RES.serif, g.g, r.size);
        ctx.restore();
      }
      ctx.restore();
    });
  } else {
    const r = stat.lines[0];
    ctx.save();
    ctx.translate(-h + 22, 26);
    for (const g of r.glyphs) {
      ctx.save();
      ctx.translate(g.px, 0);
      glyph(ctx, RES.flex, g.g, r.size);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.fillRect(-h + 22, h - 58, 28, 3);
  mono(ctx, stat.label, -h + 22, h - 24, { size: 13, weight: 700, color: fgCol, spacing: 0.1, alpha: 0.95 });
}

// Draw a motif in a tile-local frame (-120..120), fg fill style set.
function motif(ctx, m, h, bgCol, fgCol, k) {
  ctx.fillStyle = fgCol;
  ctx.strokeStyle = fgCol;
  const tau = Math.PI * 2;
  switch (m) {
    case 'quarter':
      ctx.beginPath();
      ctx.moveTo(-h, -h);
      ctx.arc(-h, -h, 2 * h * (0.98 + 0.02 * k), 0, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.72, 0, tau);
      ctx.fill();
      break;
    case 'half':
      ctx.beginPath();
      ctx.arc(0, h, h, Math.PI, tau);
      ctx.closePath();
      ctx.fill();
      break;
    case 'tri':
      ctx.beginPath();
      ctx.moveTo(-h, -h);
      ctx.lineTo(h, h);
      ctx.lineTo(-h, h);
      ctx.closePath();
      ctx.fill();
      break;
    case 'stripes': {
      const n = 4;
      const bh = (2 * h) / (2 * n - 1);
      for (let i = 0; i < n; i++) ctx.fillRect(-h, -h + i * 2 * bh, 2 * h, bh);
      break;
    }
    case 'rings':
      ctx.lineWidth = h * 0.16;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.24 * i, 0, tau);
        ctx.stroke();
      }
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.arc(-h, h, 2 * h, -Math.PI / 2, 0);
      ctx.arc(h, -h, 2 * h, Math.PI / 2, Math.PI);
      ctx.closePath();
      ctx.fill();
      break;
    case 'arch':
      ctx.beginPath();
      ctx.arc(0, h, h * 0.92, Math.PI, tau);
      ctx.arc(0, h, h * 0.46, tau, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      break;
    case 'dots':
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.arc(i * h * 0.62, j * h * 0.62, h * 0.17, 0, tau);
          ctx.fill();
        }
      break;
    case 'plain':
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(h, 0);
      ctx.lineTo(0, h);
      ctx.lineTo(-h, 0);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

// Slow push-in once the flip has landed (the grid must match the flip
// transition's tiles exactly until then).
export function gridCam(t) {
  const p = ease.inOutCubic(sat((t - T0 - 0.25) / (BAR - 0.25)));
  return { z: 1 + 0.06 * p, rot: 0.03 * p };
}

// Screen position of a tile centre under the grid camera.
export function tileScreen(tile, t) {
  const { z, rot } = gridCam(t);
  const dx = (tile.cx - W / 2) * z, dy = (tile.cy - H / 2) * z;
  const c = Math.cos(rot), s = Math.sin(rot);
  return [W / 2 + c * dx - s * dy, H / 2 + s * dx + c * dy];
}

// Tile animation state at time t.
export function tileState(tile, t) {
  const tau = t - T0;
  const diag = (tile.c + tile.r) * 0.028;
    const turn1 = ease.snap(sat((tau - BEAT + 0.04 - diag) / 0.34));
  const rot = (tile.rot + turn1) * (Math.PI / 2);
  // Radial inversion wave from the centre on beat 3.
  const dc = Math.hypot(tile.cx - W / 2, tile.cy - H / 2) / 1100;
  const inv = sat((tau - 2 * BEAT + 0.03 - dc * 0.22) / 0.3);
  // Beat 4: every plane spins down into a point, centre first, all gone
  // exactly on the next downbeat.
  const col = ease.inBack(sat((tau - 3 * BEAT + 0.005 - dc * 0.13) / 0.335), 1.7);
  return { rot, inv, col };
}

export function draw(ctx, t, { bgFill = true, pal = C } = {}) {
  if (bgFill) {
    ctx.fillStyle = pal.ink;
    ctx.fillRect(0, 0, W, H);
  }
  const cam = gridCam(t);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.z, cam.z);
  ctx.rotate(cam.rot);
  ctx.translate(-W / 2, -H / 2);
  const h = TS / 2;
  for (const tile of tiles) {
    const st = tileState(tile, t);
    const s = 1 - st.col;
    if (s <= 0.03) {
      // the plane has become a point: hold it until the burst
      if (t < T0 + BAR) {
        ctx.fillStyle = pal[tile.fg === 'ink' ? 'paper' : tile.fg];
        ctx.beginPath();
        ctx.arc(tile.cx, tile.cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.save();
    ctx.translate(tile.cx, tile.cy);
    ctx.rotate(st.col * Math.PI * 0.5);
    ctx.scale(s, s);
    // clip to the tile, slightly padded to avoid AA seams
    const pad = st.col > 0.01 ? 0 : 1.5; // overlap neighbours so AA edges never seam
    ctx.beginPath();
    ctx.rect(-h - pad, -h - pad, 2 * h + 2 * pad, 2 * h + 2 * pad);
    ctx.clip();
    const bg = pal[tile.bg];
    const fg = pal[tile.fg];
    ctx.fillStyle = bg;
    ctx.fillRect(-h - 2, -h - 2, 2 * h + 4, 2 * h + 4);
    ctx.save();
    if (tile.stat) statTile(ctx, tile.stat, h, fg);
    else {
      ctx.rotate(st.rot);
      motif(ctx, tile.motif, h, bg, fg, 1);
    }
    ctx.restore();
    if (st.inv > 0) {
      // inversion: a disc of swapped colours grows from the tile centre
      const R = ease.outExpo(st.inv) * h * 1.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = fg;
      ctx.fillRect(-h - 1, -h - 1, 2 * h + 2, 2 * h + 2);
      if (tile.stat) statTile(ctx, tile.stat, h, bg);
      else {
        ctx.rotate(st.rot);
        motif(ctx, tile.motif, h, fg, bg, 1);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
