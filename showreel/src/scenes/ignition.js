// 01 — IGNITION.  Point -> line -> type, then a dive through the "O".
// A nod to Kandinsky's "Point and Line to Plane": the reel literally starts
// from the first principles of composition.

import { C, W, H, BEAT, BAR, rgba } from '../config.js';
import { ease, spring, sat, mix, remap } from '../math.js';
import { run, glyph, contours, pill, mono, scramble } from '../draw.js';

let R;
let LINE_W = 1400;
const CX = W / 2;
const CY = H / 2;
const SIZE = 300;
const TEXT = 'MOTION';
const PORTAL = 4; // the second O
const ZMAX = 46;

export const tLine = BEAT;
export const tWord = 2 * BEAT;
export const tWave = 3 * BEAT;
export const tZoom = 3.2 * BEAT;
const tEnd = BAR;

export function init(res) {
  R = res;
  LINE_W = run(R.flex, TEXT, { size: SIZE, wght: 1000, wdth: 112 }).width + 40;
}

function letterStyle(i, t) {
  const d = Math.abs(i - 2.5) * 0.055;
  const p = ease.outExpo(sat((t - tWord - 0.05 - d) / 0.45));
  const wdth = mix(25, 112, p);
  let wght = 1000;
  const w = sat((t - tWave - i * 0.045) / 0.3);
  if (i === PORTAL) wght -= 860 * ease.inOutQuad(sat(w * 1.6)); // thins out and stays thin: a wider portal
  else wght -= 780 * Math.sin(Math.PI * w) ** 2; // weight ripple
  return { wght, wdth };
}

function pillDims(t) {
  const r0 = 22;
  const s = spring(t - 0.02, 3.1, 0.36);
  const sq = ease.inOutQuad(remap(t, 0.28, tLine));
  let w = 2 * r0 * s * (1 - 0.24 * sq);
  let h = 2 * r0 * s * (1 + 0.24 * sq);
  if (t >= tLine) {
    const p = ease.snap(sat((t - tLine) / 0.36));
    const q = ease.outExpo(sat((t - tLine) / 0.22));
    w = mix(w, LINE_W, p);
    h = mix(h, 6, q);
  }
  return { w, h };
}

// Draws the shot. Returns { portal } (design-space Path2D) once the dive
// starts, so the reel can reveal the next shot through the O's counter.
export function draw(ctx, t) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  const fr = Math.round(t * 60);

  // ---- camera: dive into the counter of the portal O
  const r = run(R.flex, TEXT, { size: SIZE, style: (i) => letterStyle(i, t) });
  const x0 = CX - r.width / 2;
  const base = CY + r.cap / 2;
  const pg = r.glyphs[PORTAL];
  const cs = contours(R.flex, pg.g);
  let counter = cs[0];
  for (const c of cs) if ((c.box.x1 - c.box.x0) * (c.box.y1 - c.box.y0) < (counter.box.x1 - counter.box.x0) * (counter.box.y1 - counter.box.y0)) counter = c;
  const s = SIZE / R.flex.upm;
  const ccx = x0 + pg.px + ((counter.box.x0 + counter.box.x1) / 2) * s;
  const ccy = base - ((counter.box.y0 + counter.box.y1) / 2) * s;
  const zp = sat((t - tZoom) / (tEnd - tZoom));
  const Z = Math.exp(Math.log(ZMAX) * ease.inQuart(zp));
  const k = ease.inOutCubic(zp);
  const px = mix(ccx, CX, k);
  const py = mix(ccy, CY, k);
  const rot = 0.12 * ease.inCubic(zp);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.scale(Z, Z);
  ctx.translate(-ccx, -ccy);

  // ---- design-tool guides through the point
  const g = ease.outExpo(remap(t, 0.02, 0.4)) * (1 - ease.inOutQuad(remap(t, 0.5, 0.85)));
  if (g > 0.001) {
    ctx.fillStyle = rgba(C.paper, 0.22 * g);
    const L = 1100 * ease.outExpo(remap(t, 0.02, 0.5));
    ctx.fillRect(CX - L, CY - 0.5, 2 * L, 1);
    ctx.fillRect(CX - 0.5, CY - L * 0.6, 1, 2 * L * 0.6);
  }

  // ---- point / line
  const { w, h } = pillDims(t);
  const open = ease.outBack(remap(t, tWord, tWord + 0.34), 1.3) * (r.cap / 2 + 30);
  const collapse = ease.inOutCubic(remap(t, tWord + 0.2, tWord + 0.55));
  if (t < tWord) {
    ctx.fillStyle = C.flame;
    pill(ctx, CX, CY, w, h);
    ctx.fill();
  } else if (collapse < 1) {
    // the line splits into two jaws that open the slit, then retract
    const lw = LINE_W * (1 - collapse);
    ctx.fillStyle = C.flame;
    pill(ctx, CX, CY - open, lw, 6);
    ctx.fill();
    pill(ctx, CX, CY + open, lw, 6);
    ctx.fill();
  }

  // ping ring on the pop
  const ring = remap(t, 0.02, 0.62);
  if (ring > 0 && ring < 1) {
    ctx.strokeStyle = rgba(C.flame, 1 - ease.outQuad(ring));
    ctx.lineWidth = 2.5 * (1 - ring) + 0.5;
    ctx.beginPath();
    ctx.arc(CX, CY, 22 + 150 * ease.outExpo(ring), 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- the word, revealed through the slit
  if (t >= tWord) {
    ctx.save();
    if (collapse < 1) {
      ctx.beginPath();
      ctx.rect(0, CY - open, W, open * 2);
      ctx.clip();
    }
    ctx.fillStyle = C.paper;
    for (const gl of r.glyphs) {
      ctx.save();
      ctx.translate(x0 + gl.px, base);
      glyph(ctx, R.flex, gl.g, SIZE);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- annotations (design-tool readouts)
  const labelA = 0.75;
  if (t < tLine + 0.05) {
    const p = remap(t, 0.08, 0.3);
    mono(ctx, scramble('POINT', p, 1, fr), CX + 44, CY - 34, { size: 12, weight: 700, color: C.paper, alpha: labelA });
    mono(ctx, scramble('X 960  Y 540', p, 2, fr), CX + 44, CY - 16, { size: 12, color: C.paper, alpha: labelA * 0.6 });
  } else if (t < tWord) {
    const p = remap(t, tLine + 0.02, tLine + 0.2);
    const len = Math.round(w);
    const ex = CX + w / 2;
    mono(ctx, scramble('LINE', p, 3, fr), ex - 4, CY - 30, { size: 12, weight: 700, color: C.paper, alpha: labelA, align: 'right' });
    mono(ctx, `W ${String(len).padStart(4, '0')}  H ${h.toFixed(0)}`, ex - 4, CY + 36, { size: 12, color: C.paper, alpha: labelA * 0.6 * p, align: 'right' });
    // end ticks
    ctx.fillStyle = rgba(C.paper, 0.5 * p);
    ctx.fillRect(CX - w / 2 - 1, CY - 16, 1, 32);
    ctx.fillRect(CX + w / 2, CY - 16, 1, 32);
  } else if (t < tZoom + 0.1) {
    const p = remap(t, tWord + 0.1, tWord + 0.35);
    const st = letterStyle(0, t);
    const ly = base + 64;
    mono(ctx, scramble('TYPE', p, 4, fr), x0, ly, { size: 12, weight: 700, color: C.paper, alpha: labelA });
    mono(ctx, scramble('ROBOTO FLEX', p, 5, fr), x0 + 62, ly, { size: 12, color: C.paper, alpha: labelA * 0.6 });
    const wg = letterStyle(2, t);
    mono(ctx, `WGHT ${Math.round(wg.wght).toString().padStart(4, '0')}   WDTH ${st.wdth.toFixed(1).padStart(5, '0')}`, x0 + r.width, ly,
      { size: 12, color: C.paper, alpha: labelA * 0.6 * p, align: 'right' });
  }

  ctx.restore();

  if (zp <= 0) return {};
  // Portal: the O's counter, in design space.
  const m = new DOMMatrix()
    .translate(px, py)
    .rotate((rot * 180) / Math.PI)
    .scale(Z, Z)
    .translate(-ccx, -ccy)
    .translate(x0 + pg.px, base)
    .scale(s, -s);
  const portal = new Path2D();
  portal.addPath(counter.path, m);
  return { portal };
}
