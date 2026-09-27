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
