// Shared 2D drawing helpers (all coordinates in design px).

import { mix } from './math.js';

// Lay out a run of outline text at `size` px. Glyph x/w are in px.
export function run(font, text, { size, wght = 400, wdth = 100, tracking = 0, style = null } = {}) {
  const L = font.layout(text, { wght, wdth, tracking, style });
  const s = size / font.upm;
  const glyphs = L.glyphs.map((g) => ({ ...g, px: g.x * s, pw: g.adv * s }));
  return { glyphs, width: L.width * s, size, font, cap: font.cap * s, xh: font.xh * s };
}

// Fill one glyph with baseline-left at the current origin.
export function glyph(ctx, font, g, size) {
  const s = size / font.upm;
  ctx.save();
  ctx.scale(s, -s);
  ctx.fill(font.path(g));
  ctx.restore();
}

export function strokeGlyph(ctx, font, g, size, lw) {
  const s = size / font.upm;
  ctx.save();
  ctx.scale(s, -s);
  ctx.lineWidth = lw / s;
  ctx.stroke(font.path(g));
  ctx.restore();
}

// Draw a laid-out run with baseline-left at (x, y).
export function drawRun(ctx, r, x, y) {
  for (const g of r.glyphs) {
    if (g.ch === ' ') continue;
    ctx.save();
    ctx.translate(x + g.px, y);
    glyph(ctx, r.font, g.g, r.size);
    ctx.restore();
  }
}

// Split an interpolated glyph into one Path2D per contour (font units),
// with bounding boxes, e.g. to punch out the counter of an "O".
export function contours(font, g) {
  const { cmds, pts } = g;
  const out = [];
  let cur = null;
  let j = 0;
  const bb = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const grow = (b, x, y) => {
    if (x < b.x0) b.x0 = x;
    if (y < b.y0) b.y0 = y;
    if (x > b.x1) b.x1 = x;
    if (y > b.y1) b.y1 = y;
  };
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c === 'M') {
      cur = { path: new Path2D(), box: bb() };
      out.push(cur);
      cur.path.moveTo(pts[j], pts[j + 1]);
      grow(cur.box, pts[j], pts[j + 1]);
      j += 2;
    } else if (c === 'L') {
      cur.path.lineTo(pts[j], pts[j + 1]);
      grow(cur.box, pts[j], pts[j + 1]);
      j += 2;
    } else if (c === 'Q') {
      cur.path.quadraticCurveTo(pts[j], pts[j + 1], pts[j + 2], pts[j + 3]);
      grow(cur.box, pts[j + 2], pts[j + 3]);
      grow(cur.box, pts[j], pts[j + 1]);
      j += 4;
    } else if (c === 'C') {
      cur.path.bezierCurveTo(pts[j], pts[j + 1], pts[j + 2], pts[j + 3], pts[j + 4], pts[j + 5]);
      grow(cur.box, pts[j + 4], pts[j + 5]);
      j += 6;
    } else if (c === 'Z') {
      cur.path.closePath();
    }
  }
  return out;
}

export function pill(ctx, cx, cy, w, h) {
  const r = Math.min(w, h) / 2;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
}

// Monospace label (canvas text, baseline at y).
export function mono(ctx, text, x, y, { size = 14, weight = 500, color = '#fff', align = 'left', spacing = 0.12, alpha = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.font = `${weight} ${size}px JBMono`;
  ctx.letterSpacing = `${spacing * size}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Serif canvas text (Instrument Serif Italic via FontFace).
export function serifText(ctx, text, x, y, { size = 40, color = '#fff', align = 'left', alpha = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.font = `${size}px ISerif`;
  ctx.letterSpacing = '0px';
  ctx.textAlign = align;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Measure mono text width.
export function monoWidth(ctx, text, size = 14, weight = 500, spacing = 0.12) {
  ctx.save();
  ctx.font = `${weight} ${size}px JBMono`;
  ctx.letterSpacing = `${spacing * size}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

// Scramble text reveal: characters resolve left to right.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>=';
export function scramble(text, p, seed = 0, frame = 0) {
  if (p >= 1) return text;
  if (p <= 0) return '';
  const n = text.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    const reveal = (i + 1) / n;
    if (ch === ' ') out += ' ';
    else if (p >= reveal) out += ch;
    else if (p >= reveal - 0.35) out += GLYPHS[(Math.abs(Math.floor(frame * 0.5) * 7 + i * 13 + seed * 31) % GLYPHS.length)];
    else out += ' ';
  }
  return out;
}

export const lerpPt = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

// Lower third: kicker / big figure / optional serif line / detail line.
// Reveals with a mask wipe from the left, exits with a fade.
//   spec: { kicker, big, serif, small }   big is drawn in `bigFont` outlines.
export function lowerThird(ctx, R, spec, t, t0, t1, opts = {}) {
  const { x = 112, y = 842, bigSize = 84, bigFont = 'serif', panel = true, accent = '#FF4D1C', color = '#F2ECE1' } = opts;
  const pin = 1 - Math.pow(2, -10 * Math.min(Math.max((t - t0) / 0.55, 0), 1));
  const pout = Math.min(Math.max((t - (t1 - 0.22)) / 0.22, 0), 1);
  if (t < t0 || pout >= 1) return;
  const a = 1 - pout * pout;
  const font = bigFont === 'serif' ? R.serif : R.flex;
  const big = run(font, spec.big, bigFont === 'serif' ? { size: bigSize } : { size: bigSize, wght: 900, wdth: 100 });
  const yK = y;
  const yB = yK + 18 + big.cap;
  const yS = spec.serif ? yB + 46 : null;
  const yD = (yS ?? yB) + 36;
  const w = Math.max(
    big.width,
    monoWidth(ctx, spec.kicker, 13, 700),
    spec.small ? monoWidth(ctx, spec.small, 12, 500) : 0,
    spec.serif ? measureSerif(ctx, spec.serif, 36) : 0,
  );
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.beginPath();
  ctx.rect(x - 34, yK - 40, (w + 68) * pin, yD - yK + 70);
  ctx.clip();
  const dy = (1 - pin) * 18;
  if (panel) {
    ctx.fillStyle = 'rgba(14,14,18,0.82)';
    ctx.beginPath();
    ctx.roundRect(x - 30, yK - 36, w + 60, yD - yK + 62, 16);
    ctx.fill();
  }
  ctx.fillStyle = accent;
  ctx.fillRect(x, yK - 17 + dy, 22, 3);
  mono(ctx, spec.kicker, x + 34, yK - 11 + dy, { size: 13, weight: 700, color: accent, spacing: 0.16 });
  ctx.fillStyle = color;
  for (const g of big.glyphs) {
    if (g.ch === ' ') continue;
    ctx.save();
    ctx.translate(x + g.px, yB + dy * 1.4);
    glyph(ctx, font, g.g, big.size);
    ctx.restore();
  }
  if (spec.serif) serifText(ctx, spec.serif, x, yS + dy * 1.8, { size: 36, color, alpha: 0.95 });
  if (spec.small) mono(ctx, spec.small, x, yD + dy * 2.2, { size: 12, weight: 500, color, spacing: 0.14, alpha: 0.7 });
  ctx.restore();
}

function measureSerif(ctx, text, size) {
  ctx.save();
  ctx.font = `${size}px ISerif`;
  ctx.letterSpacing = '0px';
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
