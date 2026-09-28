// 06 — DATA.  Eight flame columns wipe over the chrome, then settle into a
// bar chart. Stat cards spring in: an odometer, a second stat card, and a
// cursor that clicks exactly on the beat. Chart data and cards come from the
// active profile (src/profile.js).

import { C, W, H, BEAT, BAR, rgba } from '../config.js';
import { ease, spring, sat, mix } from '../math.js';
import { run, glyph, mono, serifText, monoWidth } from '../draw.js';
import { P } from '../profile.js';

export const T0 = 5 * BAR; // 9.375
let R, D;

const CH = { x0: 112, base: 868, top: 384, bw: 88, gap: 38 };
const CARD = { x: 1216, w: 592, h: 168, y0: 214, gap: 22 };
const fmt = (v) => Math.round(v).toLocaleString('en-US');

export function init(res) {
  R = res;
  D = P.data;
}

function barRect(i, tau) {
  const maxV = Math.max(...D.values);
  const h = (D.values[i] / maxV) * (CH.base - CH.top);
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

// Rolling-digit counter; lower digits spin, higher digits carry-roll.
// `digits` fixed columns, thousands grouped with a comma.
function odometer(ctx, value, x, y, size, color, digits) {
  const r = run(R.flex, '0', { size, wght: 820, wdth: 100 });
  const adv = r.glyphs[0].pw * 1.02;
  const comma = run(R.flex, ',', { size, wght: 820, wdth: 100 }).glyphs[0];
  const lh = size * 0.9;
  const slots = [];
  let cx = x;
  for (let d = 0; d < digits; d++) {
    const place = digits - 1 - d;
    slots.push({ place, x: cx });
    cx += adv;
    if (place > 0 && place % 3 === 0) {
      slots.push({ comma: true, x: cx - adv * 0.06 });
      cx += comma.pw * 0.9;
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - size * 0.8, cx - x + 8, size * 0.92);
  ctx.clip();
  ctx.fillStyle = color;
  for (const s of slots) {
    if (s.comma) {
      ctx.save();
      ctx.translate(s.x, y);
      glyph(ctx, R.flex, comma.g, size);
      ctx.restore();
      continue;
    }
    const unit = Math.pow(10, s.place);
    const base = Math.floor(value / unit);
    // ones spin freely; a higher digit rolls only while everything below it
    // is on its last unit (…999 -> …000), like a mechanical counter
    const frac = s.place === 0 ? value - Math.floor(value) : sat((value % unit) - (unit - 1));
    for (let k = 0; k < 2; k++) {
      const n = (base + k) % 10;
      const yy = y - (frac - k) * lh;
      if (yy < y - lh * 1.1 || yy > y + lh * 1.1) continue;
      const g = run(R.flex, String(n), { size, wght: 820, wdth: 100 });
      ctx.save();
      ctx.translate(s.x + (adv - g.glyphs[0].pw) / 2, yy);
      glyph(ctx, R.flex, g.glyphs[0].g, size);
      ctx.restore();
    }
  }
  ctx.restore();
  return cx - x;
}

function bigText(ctx, text, x, y, size, color) {
  const r = run(R.flex, text, { size, wght: 820, wdth: 100 });
  ctx.fillStyle = color;
  for (const g of r.glyphs) {
    if (g.ch === ' ') continue;
    ctx.save();
    ctx.translate(x + g.px, y);
    glyph(ctx, R.flex, g.g, size);
    ctx.restore();
  }
  return r.width;
}

function upTriangle(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s / 2, y - s * 0.9);
  ctx.closePath();
  ctx.fill();
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

// The cursor glides in along a curve and clicks on beat 3; returns press.
function clickAt(ctx, tau, target) {
  const clickT = 3 * BEAT;
  const mp = ease.snap(sat((tau - clickT + 0.4) / 0.4));
  if (mp <= 0) return;
  const p0 = [W + 60, H + 40], p1 = [1500, 1010], p2 = target;
  const u = mp;
  const cxp = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0];
  const cyp = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1];
  const press = Math.max(0, 1 - Math.abs(tau - clickT) / 0.09);
  cursor(ctx, cxp, cyp, press);
}

function ripple(ctx, tau, x, y) {
  const rp = sat((tau - 3 * BEAT) / 0.45);
  if (rp <= 0 || rp >= 1) return;
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.globalAlpha = 1 - rp;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 10 + 70 * ease.outExpo(rp), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------- card kinds
const CARDS = {
  // ink card with a rolling counter
  odometer(ctx, c, x, y, tau) {
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD.w, CARD.h, 20);
    ctx.fill();
    mono(ctx, c.label, x + 30, y + 42, { size: 13, weight: 700, color: C.paper, alpha: 0.6 });
    const rw = monoWidth(ctx, c.right, 13, 500);
    mono(ctx, c.right, x + CARD.w - 30, y + 42, { size: 13, color: c.up ? C.flame : C.paper, alpha: c.up ? 1 : 0.6, align: 'right', weight: c.up ? 700 : 500 });
    if (c.up) upTriangle(ctx, x + CARD.w - 30 - rw - 20, y + 41, 12, C.flame);
    const v = c.value * ease.outExpo(sat((tau - 0.3) / 0.75));
    odometer(ctx, v, x + 28, y + 146, 120, C.paper, c.digits);
  },
  // outlined card, the zero drawn as a flame ring (Claude)
  ring(ctx, c, x, y, tau) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, CARD.w - 2, CARD.h - 2, 20);
    ctx.stroke();
    mono(ctx, c.label, x + 30, y + 42, { size: 13, weight: 700, color: C.ink, alpha: 0.7 });
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
    serifText(ctx, c.caption, x + 150, y + 118, { size: 40, color: C.ink, alpha: sat((tau - 2 * BEAT) / 0.3) });
  },
  // outlined card with two counters side by side
  pair(ctx, c, x, y, tau) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, CARD.w - 2, CARD.h - 2, 20);
    ctx.stroke();
    ctx.fillStyle = rgba(C.ink, 0.15);
    ctx.fillRect(x + CARD.w / 2, y + 26, 1.5, CARD.h - 52);
    c.items.forEach((it, i) => {
      const ix = x + 30 + i * (CARD.w / 2);
      mono(ctx, it.label, ix, y + 42, { size: 12, weight: 700, color: C.ink, alpha: 0.7 });
      const p = ease.outExpo(sat((tau - 2 * BEAT + 0.12 - i * 0.08) / 0.55));
      const w = bigText(ctx, fmt(it.value * p), ix - 2, y + 140, 96, C.ink);
      // a flame underline that draws on as the count lands
      ctx.fillStyle = C.flame;
      ctx.fillRect(ix, y + 152, (w - 4) * ease.inOutCubic(sat((tau - 2 * BEAT - 0.1 - i * 0.08) / 0.35)), 5);
    });
  },
  // sun card with a toggle the cursor flips on the beat (Claude)
  toggle(ctx, c, x, y, tau) {
    ctx.fillStyle = C.sun;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD.w, CARD.h, 20);
    ctx.fill();
    mono(ctx, c.label, x + 30, y + 42, { size: 13, weight: 700, color: C.ink, alpha: 0.8 });
    const on = ease.snap(sat((tau - 3 * BEAT - 0.02) / 0.26));
    const tx = x + CARD.w - 30 - 132, ty = y + 78, tw = 132, th = 64;
    ctx.fillStyle = on > 0.5 ? C.flame : C.ink;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, th / 2);
    ctx.fill();
    const kx = mix(tx + th / 2, tx + tw - th / 2, on);
    const squash = 1 + 0.25 * Math.sin(Math.PI * on);
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.ellipse(kx, ty + th / 2, 24 * squash, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    const w = bigText(ctx, on > 0.5 ? 'ON' : 'OFF', x + 28, y + 146, 96, C.ink);
    mono(ctx, c.caption, x + 30 + w + 22, y + 146, { size: 13, weight: 700, color: C.ink, alpha: 0.7 });
    ripple(ctx, tau, tx + tw * 0.62, ty + th * 0.55);
    clickAt(ctx, tau, [tx + tw * 0.62, ty + th * 0.55]);
  },
  // sun card: what you write about + where, with a Follow button
  social(ctx, c, x, y, tau) {
    ctx.fillStyle = C.sun;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD.w, CARD.h, 20);
    ctx.fill();
    mono(ctx, c.label, x + 30, y + 42, { size: 13, weight: 700, color: C.ink, alpha: 0.8 });
    serifText(ctx, c.text, x + 28, y + 104, { size: 48, color: C.ink });
    mono(ctx, c.handle, x + 30, y + 144, { size: 14, weight: 700, color: C.ink, spacing: 0.06 });
    const on = ease.snap(sat((tau - 3 * BEAT - 0.02) / 0.22));
    const label = on > 0.5 ? c.button[1] : c.button[0];
    const tw = 172, th = 58;
    const tx = x + CARD.w - 30 - tw, ty = y + CARD.h - 30 - th;
    const pop = 1 + 0.08 * Math.sin(Math.PI * on);
    ctx.save();
    ctx.translate(tx + tw / 2, ty + th / 2);
    ctx.scale(pop, pop);
    ctx.fillStyle = on > 0.5 ? C.flame : C.ink;
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
    ctx.fill();
    const lw = monoWidth(ctx, label, 15, 700, 0.04);
    const check = on > 0.5 ? 22 : 0;
    const lx = -(lw + check) / 2;
    if (check) {
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const k = ease.outCubic(sat((tau - 3 * BEAT - 0.1) / 0.18));
      ctx.beginPath();
      ctx.moveTo(lx, 1);
      ctx.lineTo(lx + 5 * Math.min(1, k * 2), 1 + 5 * Math.min(1, k * 2));
      if (k > 0.5) ctx.lineTo(lx + 5 + 9 * (k - 0.5) * 2, 6 - 12 * (k - 0.5) * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    mono(ctx, label, lx + check, 5, { size: 15, weight: 700, color: C.paper, spacing: 0.04 });
    ctx.restore();
    ripple(ctx, tau, tx + tw * 0.5, ty + th * 0.5);
    clickAt(ctx, tau, [tx + tw * 0.55, ty + th * 0.6]);
  },
};

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
  const n = D.values.length;
  const chartW = n * CH.bw + (n - 1) * CH.gap;
  ctx.fillStyle = rgba(C.ink, 0.1);
  for (let k = 1; k <= 4; k++) {
    const y = CH.base - (k / 4) * (CH.base - CH.top);
    ctx.fillRect(CH.x0, y, chartW * sat(gp * 1.2 - k * 0.05), 1);
  }
  const lp = sat((tau - 0.1) / 0.3);
  mono(ctx, D.title, CH.x0, 214, { size: 13, weight: 700, color: C.ink, alpha: lp });
  mono(ctx, D.subtitle, CH.x0 + monoWidth(ctx, D.title, 13, 700) + 24, 214, { size: 13, color: C.ink, alpha: 0.5 * lp });
  // headline, revealed from under a mask
  {
    const hp = ease.outExpo(sat((tau - 0.14) / 0.5));
    ctx.save();
    ctx.beginPath();
    ctx.rect(CH.x0 - 10, 226, 1000, 80);
    ctx.clip();
    serifText(ctx, D.headline, CH.x0 - 2, 290 + (1 - hp) * 70, { size: 62, color: C.ink });
    ctx.restore();
  }

  // ---- bars
  const vp = ease.outExpo(sat((tau - BEAT) / 0.5));
  const tops = [];
  for (let i = 0; i < n; i++) {
    const b = barRect(i, tau);
    const hl = i === D.highlight;
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
    mono(ctx, D.labels[i], b.bx + CH.bw / 2, CH.base + 30 + (1 - la) * 10, { size: 12, weight: 700, color: C.ink, align: 'center', alpha: la });
    if (vp > 0) {
      mono(ctx, fmt(D.values[i] * vp), b.bx + CH.bw / 2, b.top + 34, { size: 13, weight: 700, color: C.paper, align: 'center', alpha: sat(vp * 3) });
    }
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(CH.x0 - 16, CH.base, (chartW + 32) * gp, 2);

  // ---- trend line through the bar tops, drawn on beat 2
  {
    const p = ease.inOutCubic(sat((tau - BEAT - 0.05) / 0.55));
    if (p > 0) {
      const pts = tops;
      const xEnd = mix(pts[0][0], pts[n - 1][0], p);
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
        const s = spring((xEnd - x) / 400, 3, 0.4);
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
  D.cards.forEach((c, k) => {
    const s = spring(tau - 0.1 - k * 0.06, 2.3, 0.62);
    const x = CARD.x + (1 - s) * 760;
    const y = CARD.y0 + k * (CARD.h + CARD.gap);
    CARDS[c.kind](ctx, c, x, y, tau);
  });
  ctx.restore();
}
