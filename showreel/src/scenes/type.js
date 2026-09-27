// 02 — TYPE.  "TIMING is EVERYTHING." — one word per beat, each with its own
// entrance: a squash-and-stretch drop, an elastic pop, an accordion slide
// that compresses on the width axis, and a bouncing full stop.

import { C, W, H, BEAT, BAR } from '../config.js';
import { ease, spring, sat, mix, remap, clamp } from '../math.js';
import { run, glyph } from '../draw.js';

let R;
export const T0 = BAR; // shot start (1.875)
const MARGIN = 112;
const COL = W - MARGIN * 2;

let L1, L3, isRun, layout;

export function init(res) {
  R = res;
  const f = R.flex;
  // Line 1: TIMING, width-axis justified to the column.
  const s1 = 390;
  const w1 = f.fitWidth('TIMING', (COL / s1) * f.upm, 1000);
  // Line 3: EVERYTHING. justified the same way.
  const s3 = 246;
  const w3 = f.fitWidth('EVERYTHING.', (COL / s3) * f.upm, 1000);
  L1 = { size: s1, wdth: w1 };
  L3 = { size: s3, wdth: w3 };
  const cap1 = (f.cap / f.upm) * s1;
  const cap3 = (f.cap / f.upm) * s3;
  const xhS = (R.serif.xh / R.serif.upm) * 200;
  const gap = 44;
  const total = cap1 + gap + xhS + gap + cap3;
  const top = (H - total) / 2 - 6;
  layout = {
    base1: top + cap1,
    baseIs: top + cap1 + gap + xhS,
    base3: top + cap1 + gap + xhS + gap + cap3,
    cap1,
    cap3,
  };
  isRun = run(R.serif, 'is', { size: 200 });
}

// Diagonal weight ripple that closes the shot.
function ripple(t, x, y) {
  const d = (x / W) * 0.22 + (y / H) * 0.12;
  const p = sat((t - (T0 + 3.5 * BEAT) - d) / 0.3);
  return 700 * Math.sin(Math.PI * p) ** 2;
}

export function draw(ctx, t) {
  ctx.fillStyle = C.flame;
  ctx.fillRect(0, 0, W, H);
  const tau = t - T0;
  if (tau < -0.3) return;
  ctx.fillStyle = C.ink;
  const f = R.flex;

  // ---- TIMING: drop with squash & stretch; first letter lands on the downbeat.
  {
    const r = run(f, 'TIMING', { size: L1.size, wght: 1000, wdth: L1.wdth });
    for (const g of r.glyphs) {
      const land = g.i * 0.034;
      const fall = 0.17;
      const u = tau - (land - fall);
      if (u < 0) continue;
      let y = 0, sx = 1, sy = 1;
      if (tau < land) {
        const p = u / fall;
        y = -(H * 0.95) * (1 - p * p); // gravity-style ease-in
        sy = 1 + 0.35 * p;
        sx = 1 - 0.18 * p;
      } else {
        const v = tau - land;
        // impact squash, spring back through a small stretch
        const k = 1 - spring(v, 3.2, 0.32);
        sy = 1 - 0.3 * k;
        sx = 1 + 0.15 * k;
        y = -26 * Math.max(0, Math.sin(Math.PI * clamp((v - 0.06) / 0.2, 0, 1))) * (v > 0.06 ? 1 : 0);
      }
      const cx = MARGIN + g.px + g.pw / 2;
      const wg = 1000 - ripple(t, cx, layout.base1);
      const gg = wg < 999 ? f.glyph(g.ch, wg, L1.wdth) : g.g;
      ctx.save();
      ctx.translate(cx, layout.base1 + y);
      ctx.scale(sx, sy);
      ctx.translate(-g.pw / 2, 0);
      glyph(ctx, f, gg, L1.size);
      ctx.restore();
    }
  }

  // ---- is: elastic pop with rules drawing out to the margins.
  {
    const u = tau - BEAT;
    if (u > -0.02) {
      const s = spring(u, 2.6, 0.34);
      const rot = (1 - spring(u, 2.2, 0.4)) * -0.5;
      const cx = W / 2;
      ctx.save();
      ctx.translate(cx, layout.baseIs);
      ctx.rotate(rot);
      ctx.scale(s, s);
      ctx.translate(-isRun.width / 2, 0);
      for (const g of isRun.glyphs) {
        ctx.save();
        ctx.translate(g.px, 0);
        glyph(ctx, R.serif, g.g, isRun.size);
        ctx.restore();
      }
      ctx.restore();
      const rp = ease.outExpo(sat((u - 0.05) / 0.4));
      const gap = isRun.width / 2 + 46;
      const ry = layout.baseIs - (R.serif.xh / R.serif.upm) * 200 * 0.42;
      const len = (W / 2 - gap - MARGIN) * rp;
      ctx.fillRect(cx - gap - len, ry - 2, len, 4);
      ctx.fillRect(cx + gap, ry - 2, len, 4);
    }
  }

  // ---- EVERYTHING.: accordion slide — enters wide, compresses into place.
  {
    const u = tau - 2 * BEAT;
    if (u > -0.02) {
      const n = 11;
      const style = (i) => {
        const p = ease.outExpo(sat((u - i * 0.022) / 0.5));
        return { wght: 1000, wdth: mix(151, L3.wdth, p) };
      };
      const r = run(f, 'EVERYTHING.', { size: L3.size, style });
      const slide = ease.outExpo(sat(u / 0.42));
      const x0 = mix(W + 40, MARGIN, slide);
      for (const g of r.glyphs) {
        if (g.ch === '.') continue;
        const cx = x0 + g.px + g.pw / 2;
        const wg = 1000 - ripple(t, cx, layout.base3);
        const gg = wg < 999 ? f.glyph(g.ch, wg, g.wdth) : g.g;
        ctx.save();
        ctx.translate(x0 + g.px, layout.base3);
        glyph(ctx, f, gg, L3.size);
        ctx.restore();
      }
      // ---- the full stop: a paper dot that drops in on beat 4.
      const dotG = r.glyphs[n - 1];
      const fin = run(f, 'EVERYTHING.', { size: L3.size, wght: 1000, wdth: L3.wdth });
      const fd = fin.glyphs[n - 1];
      const dr = L3.size * 0.105;
      const dx = MARGIN + fd.px + fd.pw / 2;
      const dy = layout.base3 - dr;
      const v = tau - 3 * BEAT;
      if (v > -0.2 && dotG) {
        let y, sx = 1, sy = 1;
        const fall = 0.16;
        if (v < 0) {
          const p = (v + fall) / fall;
          y = dy - (dy + 60) * (1 - p * p);
          sy = 1 + 0.5 * p;
          sx = 1 - 0.25 * p;
        } else {
          const k = 1 - spring(v, 3.6, 0.3);
          sy = 1 - 0.45 * k;
          sx = 1 + 0.35 * k;
          y = dy - 60 * Math.max(0, Math.sin(Math.PI * clamp((v - 0.05) / 0.22, 0, 1)));
        }
        ctx.save();
        ctx.fillStyle = C.paper;
        ctx.translate(dx, y + dr);
        ctx.scale(sx, sy);
        ctx.beginPath();
        ctx.arc(0, -dr, dr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // landing ping
        const pr = sat(v / 0.5);
        if (v > 0 && pr < 1) {
          ctx.strokeStyle = C.paper;
          ctx.globalAlpha = 1 - pr;
          ctx.lineWidth = 3 * (1 - pr) + 0.5;
          ctx.beginPath();
          ctx.arc(dx, dy, dr + 120 * ease.outExpo(pr), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}
