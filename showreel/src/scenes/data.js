// 06 — DATA.  Eight ink columns wipe over the chrome, then settle into a
// bar chart of this reel's own render cost. Stat cards spring in: an
// odometer rolling to 900 frames, a zero drawn as a ring, and a cursor that
// flips motion blur on exactly on the beat.

import { C, W, H, BEAT, BAR, rgba, mixHex } from '../config.js';
import { ease, spring, sat, mix, remap, clamp } from '../math.js';
import { run, glyph, mono, serifText } from '../draw.js';

export const T0 = 5 * BAR; // 9.375
let R;

// Per-shot average frame time (ms) from the final render log.
export const STATS = [664, 1150, 1161, 1418, 3544, 530, 734, 560];
const LABELS = ['IGN', 'TYPE', 'GEO', 'PART', 'DIM', 'DATA', 'MONT', 'SIGN'];

const CH = { x0: 112, base: 868, top: 384, bw: 88, gap: 38 };
const CARD = { x: 1216, w: 592, h: 168, y0: 214, gap: 22 };

export function init(res) {
  R = res;
}

function barRect(i, tau) {
  const maxV = Math.max(...STATS);
  const h = (STATS[i] / maxV) * (CH.base - CH.top);
  const bx = CH.x0 + i * (CH.bw + CH.gap);
  // column -> bar morph
  const d = i * 0.028;
  const mw = ease.swift(sat((tau - d) / 0.3));
  const mh = ease.swift(sat((tau - d) / 0.4));
  const x = mix(i * 240, bx, mw);
  const w = mix(240, CH.bw, mw);
  // settle without overshooting the axis, then a small bounce scaled to
  // the bar's own height
  const u = tau - d - 0.3;
  const bounce = u > 0 ? Math.sin((u * Math.PI) / 0.22) * Math.exp(-u / 0.13) : 0;
  const top = Math.min(mix(0, CH.base - h, mh) - h * 0.16 * bounce, CH.base - 3);
  const bottom = mix(H, CH.base, ease.snap(sat((tau - d) / 0.3)));
  return { x, w, top, bottom, h, bx, mw };
}

// The pre-roll: flame columns rise over the previous shot in a staircase.
export function drawWipe(ctx, t) {
  const tau = t - T0;
  ctx.fillStyle = C.flame;
  for (let i = 0; i < 8; i++) {
    const end = -(7 - i) * 0.02;
    const p = ease.inCubic(sat((tau - (end - 0.22)) / 0.22));
    if (p <= 0) continue;
    const top = H * (1 - p);
    ctx.fillRect(i * 240 - 0.5, top, 241, H - top);
  }
}

function odometer(ctx, value, x, y, size, color) {
  // Each digit column scrolls continuously; lower digits spin faster.
  const digits = 3;
  const r = run(R.flex, '0', { size, wght: 820, wdth: 100 });
  const adv = r.glyphs[0].pw * 1.02;
  const lh = size * 0.9;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - size * 0.8, adv * digits + 8, size * 0.92);
  ctx.clip();
  ctx.fillStyle = color;
  for (let d = 0; d < digits; d++) {
    const place = Math.pow(10, digits - 1 - d);
    const v = value / place; // continuous
    const base = Math.floor(v);
    const frac = d === digits - 1 ? v - base : sat((v - base - 0.9) * 10); // carry roll
    for (let k = 0; k < 2; k++) {
      const n = (base + k) % 10;
      const yy = y - (frac - k) * lh;
      if (yy < y - lh * 1.1 || yy > y + lh * 1.1) continue;
      const g = run(R.flex, String(n), { size, wght: 820, wdth: 100 });
      ctx.save();
      ctx.translate(x + d * adv + (adv - g.glyphs[0].pw) / 2, yy);
      glyph(ctx, R.flex, g.glyphs[0].g, size);
      ctx.restore();
    }
  }
  ctx.restore();
}

function cursor(ctx, x, y, press) {
  ctx.save();
  ctx.translate(x, y);
  const s = 1.25 * (1 - 0.14 * press);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(6.5, 20);
  ctx.lineTo(11, 30);
  ctx.lineTo(15, 28);
  ctx.lineTo(10.5, 18.5);
  ctx.lineTo(19, 18.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(14,14,18,0.18)';
  ctx.save();
  ctx.translate(2, 3);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = C.paper;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

export function draw(ctx, t) {
  const tau = t - T0;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  const push = 1 + 0.025 * ease.inOutCubic(sat(tau / BAR));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(push, push);
  ctx.translate(-W / 2, -H / 2);

  // ---- chart furniture
  const gp = ease.outExpo(sat((tau - 0.12) / 0.5));
  const chartW = 8 * CH.bw + 7 * CH.gap;
  ctx.fillStyle = rgba(C.ink, 0.1);
  for (let k = 1; k <= 4; k++) {
    const y = CH.base - (k / 4) * (CH.base - CH.top);
    ctx.fillRect(CH.x0, y, chartW * sat(gp * 1.2 - k * 0.05), 1);
  }
  const lp = sat((tau - 0.1) / 0.3);
  mono(ctx, 'RENDER COST / SHOT', CH.x0, 214, { size: 13, weight: 700, color: C.ink, alpha: lp });
  mono(ctx, 'MS PER FRAME · 1920×1080 · SWIFTSHADER', CH.x0 + 196, 214, { size: 13, color: C.ink, alpha: 0.5 * lp });
  // headline, revealed from under a mask
  {
    const hp = ease.outExpo(sat((tau - 0.14) / 0.5));
    ctx.save();
    ctx.beginPath();
    ctx.rect(CH.x0 - 10, 226, 1000, 80);
    ctx.clip();
    serifText(ctx, 'Every frame, measured.', CH.x0 - 2, 290 + (1 - hp) * 70, { size: 62, color: C.ink });
    ctx.restore();
  }

  // ---- bars
  const maxV = Math.max(...STATS);
  const vp = ease.outExpo(sat((tau - BEAT) / 0.5));
  const tops = [];
  for (let i = 0; i < 8; i++) {
    const b = barRect(i, tau);
    const hl = i === 4;
    // the wipe's flame drains out: ink fills each bar from the base up
    // (the hero bar stays hot). Columns overlap a hair until they separate.
    const ov = 1.2 * (1 - b.mw);
    ctx.fillStyle = C.flame;
    ctx.fillRect(b.x - ov, b.top, b.w + 2 * ov, b.bottom - b.top);
    if (!hl) {
      const fill = ease.inOutCubic(sat((tau - i * 0.03 - 0.04) / 0.32));
      const hh = (b.bottom - b.top) * fill;
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x - ov, b.bottom - hh, b.w + 2 * ov, hh);
    }
    tops.push([b.bx + CH.bw / 2, b.top]);
    const la = sat((tau - 0.3 - i * 0.03) / 0.2);
    mono(ctx, LABELS[i], b.bx + CH.bw / 2, CH.base + 30 + (1 - la) * 10, { size: 12, weight: 700, color: C.ink, align: 'center', alpha: la });
    if (vp > 0) {
      const v = Math.round(STATS[i] * vp);
      mono(ctx, String(v), b.bx + CH.bw / 2, b.top + 34, { size: 13, weight: 700, color: C.paper, align: 'center', alpha: sat(vp * 3) });
    }
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(CH.x0 - 16, CH.base, (chartW + 32) * gp, 2);

  // ---- trend line through the bar tops, drawn on beat 2
  {
    const p = ease.inOutCubic(sat((tau - BEAT - 0.05) / 0.55));
    if (p > 0) {
      const pts = tops.map(([x, y]) => [x, y]);
      const xEnd = mix(pts[0][0], pts[7][0], p);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, xEnd, H);
      ctx.clip();
      ctx.strokeStyle = C.cobalt;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
      for (const [x, y] of pts) {
        const s = spring(((xEnd - x) / 400), 3, 0.4);
        if (x > xEnd + 1) continue;
        ctx.fillStyle = C.paper;
        ctx.beginPath();
        ctx.arc(x, y, 7 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = C.cobalt;
        ctx.stroke();
      }
    }
  }

  // ---- stat cards spring in from the right
  const cards = [0, 1, 2].map((k) => {
    const s = spring(tau - 0.1 - k * 0.06, 2.3, 0.62);
    return { x: CARD.x + (1 - s) * 760, y: CARD.y0 + k * (CARD.h + CARD.gap) };
  });
  // card 1: frames odometer (ink)
  {
    const { x, y } = cards[0];
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD.w, CARD.h, 20);
    ctx.fill();
    mono(ctx, 'FRAMES', x + 30, y + 42, { size: 13, weight: 700, color: C.paper, alpha: 0.6 });
    mono(ctx, '15.000 S @ 60 FPS', x + CARD.w - 30, y + 42, { size: 13, color: C.paper, alpha: 0.6, align: 'right' });
    const v = 900 * ease.outExpo(sat((tau - 0.3) / 0.75));
    odometer(ctx, v, x + 28, y + 146, 120, C.paper);
  }
  // card 2: keyframes = 0, the zero drawn as a ring
  {
    const { x, y } = cards[1];
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, CARD.w - 2, CARD.h - 2, 20);
    ctx.stroke();
    mono(ctx, 'KEYFRAMES', x + 30, y + 42, { size: 13, weight: 700, color: C.ink, alpha: 0.7 });
    const rp = ease.inOutCubic(sat((tau - 2 * BEAT + 0.08) / 0.34));
    const pop = rp >= 1 ? 1 + 0.12 * (1 - spring(tau - 2 * BEAT - 0.26, 3, 0.35)) : 1;
    const cx = x + 76, cy = y + 104, rr = 38 * pop;
    if (rp > 0) {
      ctx.strokeStyle = C.flame;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr * 0.8, rr, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rp);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    serifText(ctx, 'every curve is a function', x + 150, y + 118, { size: 40, color: C.ink, alpha: sat((tau - 2 * BEAT) / 0.3) });
  }
  // card 3: motion blur toggle, clicked on beat 3
  {
    const { x, y } = cards[2];
    ctx.fillStyle = C.sun;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD.w, CARD.h, 20);
    ctx.fill();
    mono(ctx, 'MOTION BLUR', x + 30, y + 42, { size: 13, weight: 700, color: C.ink, alpha: 0.8 });
    const clickT = 3 * BEAT;
    const on = ease.snap(sat((tau - clickT - 0.02) / 0.26));
    const tx = x + CARD.w - 30 - 132, ty = y + 78, tw = 132, th = 64;
    ctx.fillStyle = on > 0.5 ? C.flame : C.ink;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, th / 2);
    ctx.fill();
    const kx = mix(tx + th / 2, tx + tw - th / 2, on);
    const squash = 1 + 0.25 * Math.sin(Math.PI * on);
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.ellipse(kx, ty + th / 2, 24 * squash, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    const sp = '16 SAMPLES · 180° SHUTTER';
    const big = run(R.flex, on > 0.5 ? 'ON' : 'OFF', { size: 96, wght: 820, wdth: 100 });
    ctx.fillStyle = C.ink;
    ctx.save();
    ctx.translate(x + 28, y + 146);
    for (const g of big.glyphs) {
      ctx.save();
      ctx.translate(g.px, 0);
      glyph(ctx, R.flex, g.g, 96);
      ctx.restore();
    }
    ctx.restore();
    mono(ctx, sp, x + 30 + big.width + 22, y + 146, { size: 13, weight: 700, color: C.ink, alpha: 0.7 });
    // click ripple
    const rp = sat((tau - clickT) / 0.45);
    if (rp > 0 && rp < 1) {
      ctx.strokeStyle = C.ink;
      ctx.globalAlpha = 1 - rp;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx + tw * 0.62, ty + th * 0.55, 10 + 70 * ease.outExpo(rp), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the cursor glides in along a curve and clicks on the beat
    const mp = ease.snap(sat((tau - clickT + 0.4) / 0.4));
    if (mp > 0) {
      const p0 = [W + 60, H + 40], p1 = [1500, 1010], p2 = [tx + tw * 0.62, ty + th * 0.55];
      const u = mp;
      const cxp = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0];
      const cyp = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1];
      const press = Math.max(0, 1 - Math.abs(tau - clickT) / 0.09);
      cursor(ctx, cxp, cyp, press);
    }
  }
  ctx.restore();
}
