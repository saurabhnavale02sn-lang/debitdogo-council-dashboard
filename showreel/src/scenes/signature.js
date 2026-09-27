// 08 — SIGNATURE.  The point from the first frame returns. It travels
// right and writes the name as it passes, then lands as the full stop.

import { C, W, H, BEAT, BAR, rgba } from '../config.js';
import { ease, spring, sat, mix, remap, clamp } from '../math.js';
import { run, glyph, mono, serifText, scramble } from '../draw.js';

export const T0 = 7 * BAR; // 13.125
let R, name, SIZE, X0, BASE, DOT_R, DOT_X, DOT_Y;
const WGHT = 700;
const WDTH = 116;

export function init(res) {
  R = res;
  SIZE = 272;
  name = run(R.flex, 'Claude', { size: SIZE, wght: WGHT, wdth: WDTH, tracking: -0.01 });
  DOT_R = SIZE * 0.085;
  const gap = SIZE * 0.05;
  const total = name.width + gap + DOT_R * 2;
  X0 = W / 2 - total / 2;
  BASE = H / 2 + name.cap / 2 - 40;
  DOT_X = X0 + name.width + gap + DOT_R;
  DOT_Y = BASE - DOT_R;
}

// Where the travelling point is, for the montage's last beat too.
export const pointHome = () => [W / 2, H / 2];

export function dotState(t) {
  const tau = t - T0;
  // anticipation happens at the end of the montage (tau < 0)
  if (tau < 0) {
    // waits where the name will begin, winding up (squash + pull-back)
    const a = ease.inOutQuad(sat((tau + 0.2) / 0.2));
    return { x: X0 - DOT_R * 3 - 18 * a, y: H / 2, sx: 1 - 0.3 * a, sy: 1 + 0.3 * a, r: DOT_R };
  }
  const p = ease.snap(sat(tau / 0.42));
  const x = mix(X0 - DOT_R * 3, DOT_X, p);
  const y = mix(H / 2, DOT_Y, ease.outCubic(sat(tau / 0.3)));
  // velocity stretch, then a landing squash
  const v = Math.sin(Math.PI * p);
  const land = tau > 0.42 ? 1 - spring(tau - 0.42, 3.2, 0.3) : 0;
  const sx = 1 + 1.6 * v - 0.3 * land;
  const sy = 1 - 0.35 * v + 0.35 * land;
  return { x, y, sx, sy, r: DOT_R, p };
}

export function draw(ctx, t) {
  const tau = t - T0;
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  const fr = Math.round(t * 60);
  const push = 1 + 0.045 * ease.inOutSine(sat(tau / BAR));
  ctx.save();
  ctx.translate(W / 2, H / 2 - 20);
  ctx.scale(push, push);
  ctx.translate(-W / 2, -(H / 2 - 20));

  const d = dotState(t);
  // letters pop up as the point passes them
  const breathe = 40 * Math.sin(Math.max(0, tau - 1.1) * 4.2) * sat((tau - 1.1) / 0.3);
  ctx.fillStyle = C.paper;
  for (const g of name.glyphs) {
    const gx = X0 + g.px;
    const passT = clamp((gx + g.pw * 0.3 - (X0 - DOT_R * 3)) / (DOT_X - X0 + DOT_R * 3), 0, 1);
    // invert the dot's easing to find when it passed this glyph
    let lo = 0, hi = 0.42;
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2;
      if (ease.snap(m / 0.42) < passT) lo = m; else hi = m;
    }
    const u = tau - lo;
    if (u <= 0) continue;
    const s = spring(u, 2.8, 0.42);
    const wg = mix(100, WGHT, ease.outExpo(sat(u / 0.3))) + breathe;
    const wd = mix(151, WDTH, ease.outExpo(sat(u / 0.35)));
    const gg = R.flex.glyph(g.ch, wg, wd);
    ctx.save();
    ctx.translate(gx, BASE);
    ctx.scale(1, s);
    glyph(ctx, R.flex, gg, SIZE);
    ctx.restore();
  }

  // the point
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.sx, d.sy);
  ctx.fillStyle = C.flame;
  ctx.beginPath();
  ctx.arc(0, 0, d.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // landing ping, then one more on the last beat
  for (const [t1, amp] of [[0.44, 1], [3 * BEAT, 0.6]]) {
    const rp = sat((tau - t1) / 0.7);
    if (rp > 0 && rp < 1) {
      ctx.strokeStyle = rgba(C.flame, (1 - rp) * amp);
      ctx.lineWidth = 2.5 * (1 - rp) + 0.5;
      ctx.beginPath();
      ctx.arc(DOT_X, DOT_Y, DOT_R + 190 * ease.outExpo(rp), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // sub-line: rule + role + year
  const sp = sat((tau - BEAT) / 0.4);
  const ry = BASE + 78;
  const rw = (DOT_X + DOT_R - X0) * ease.snap(sat((tau - BEAT + 0.05) / 0.45));
  ctx.fillStyle = rgba(C.paper, 0.35);
  ctx.fillRect(X0 + 6, ry, rw, 1.5);
  mono(ctx, scramble('MOTION DESIGNER', sp, 11, fr), X0 + 6, ry + 40, { size: 17, weight: 700, color: C.paper, spacing: 0.3 });
  mono(ctx, scramble('SHOWREEL 2026', sp, 12, fr), DOT_X + DOT_R, ry + 40, { size: 17, weight: 400, color: C.paper, spacing: 0.3, align: 'right', alpha: 0.7 });
  // tagline
  const tp = ease.outExpo(sat((tau - 2 * BEAT) / 0.6));
  serifText(ctx, 'every frame, written in code.', W / 2, ry + 136 + (1 - tp) * 24, { size: 46, color: C.paper, align: 'center', alpha: tp * 0.9 });
  ctx.restore();
}
