// Variable-font outline engine.
//
// Glyph outlines are sampled at the font's gvar breakpoints (see
// tools/build_glyphs.py), so bilinear interpolation between neighbouring
// masters is exact. Every glyph can carry its own weight/width per frame,
// which is what makes the width-morph and weight-wave effects possible.

export class OutlineFont {
  constructor(data) {
    this.upm = data.upm;
    this.asc = data.asc;
    this.desc = data.desc;
    this.cap = data.cap;
    this.xh = data.xh;
    this.glyphs = data.glyphs;
    this.kerns = data.kern;
    this.axW = data.axes && data.axes.wght ? data.axes.wght : null;
    this.axD = data.axes && data.axes.wdth ? data.axes.wdth : null;
    this.cache = new Map();
    for (const ch in this.glyphs) {
      const g = this.glyphs[ch];
      g.p = g.p.map((a) => Float32Array.from(a));
    }
  }

  // Returns [[i0, i1, i2, i3], [w00, w10, w01, w11]] master indices/weights.
  _weights(wght, wdth) {
    if (!this.axW) return null;
    const cell = (axis, v) => {
      v = Math.min(Math.max(v, axis[0]), axis[axis.length - 1]);
      let i = 0;
      while (i < axis.length - 2 && v > axis[i + 1]) i++;
      return [i, (v - axis[i]) / (axis[i + 1] - axis[i])];
    };
    const [wi, u] = cell(this.axW, wght);
    const [di, v] = cell(this.axD, wdth);
    const nd = this.axD.length;
    return [
      [wi * nd + di, (wi + 1) * nd + di, wi * nd + di + 1, (wi + 1) * nd + di + 1],
      [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v],
    ];
  }

  // Interpolated glyph: { cmds, pts: Float32Array, adv }
  glyph(ch, wght = 400, wdth = 100) {
    const g = this.glyphs[ch] || this.glyphs['?'];
    const key = ch + '|' + wght.toFixed(2) + '|' + wdth.toFixed(2);
    const hit = this.cache.get(key);
    if (hit) return hit;
    let pts, adv;
    const w = this._weights(wght, wdth);
    if (!w) {
      pts = g.p[0];
      adv = g.a[0];
    } else {
      const [idx, wt] = w;
      const n = g.p[0].length;
      pts = new Float32Array(n);
      adv = 0;
      for (let k = 0; k < 4; k++) {
        if (wt[k] === 0) continue;
        const src = g.p[idx[k]];
        for (let i = 0; i < n; i++) pts[i] += src[i] * wt[k];
        adv += g.a[idx[k]] * wt[k];
      }
    }
    const out = { ch, cmds: g.c, pts, adv, path: null };
    if (this.cache.size > 20000) this.cache.clear();
    this.cache.set(key, out);
    return out;
  }

  kern(a, b, wght = 400, wdth = 100) {
    const k = this.kerns[a + b];
    if (!k) return 0;
    const w = this._weights(wght, wdth);
    if (!w) return k[0];
    let s = 0;
    for (let i = 0; i < 4; i++) s += k[w[0][i]] * w[1][i];
    return s;
  }

  // Path2D in font units (y-up). Cached per interpolated glyph.
  path(gl) {
    if (gl.path) return gl.path;
    const p = new Path2D();
    const { cmds, pts } = gl;
    let j = 0;
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds.charCodeAt(i);
      if (c === 77) { p.moveTo(pts[j], pts[j + 1]); j += 2; }
      else if (c === 76) { p.lineTo(pts[j], pts[j + 1]); j += 2; }
      else if (c === 81) { p.quadraticCurveTo(pts[j], pts[j + 1], pts[j + 2], pts[j + 3]); j += 4; }
      else if (c === 67) { p.bezierCurveTo(pts[j], pts[j + 1], pts[j + 2], pts[j + 3], pts[j + 4], pts[j + 5]); j += 6; }
      else if (c === 90) p.closePath();
    }
    gl.path = p;
    return p;
  }

  // Lay out a string. `style(i, ch)` may return per-glyph {wght, wdth}.
  // Returns { glyphs: [{ch, x, adv, g, wght, wdth}], width } in font units.
  layout(text, opts = {}) {
    const base = { wght: opts.wght ?? 400, wdth: opts.wdth ?? 100 };
    const tracking = opts.tracking ?? 0; // in em
    const out = [];
    let x = 0;
    let prev = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const st = opts.style ? { ...base, ...opts.style(i, ch) } : base;
      if (prev) {
        x += this.kern(prev.ch, ch, (prev.wght + st.wght) / 2, (prev.wdth + st.wdth) / 2);
      }
      const g = this.glyph(ch, st.wght, st.wdth);
      out.push({ ch, i, x, adv: g.adv, g, wght: st.wght, wdth: st.wdth });
      x += g.adv + tracking * this.upm;
      prev = out[out.length - 1];
    }
    const width = out.length ? x - tracking * this.upm : 0;
    return { glyphs: out, width };
  }

  // Solve the width axis so `text` spans `targetUnits` font units.
  fitWidth(text, targetUnits, wght, tracking = 0, lo = null, hi = null) {
    lo = lo ?? (this.axD ? this.axD[0] : 100);
    hi = hi ?? (this.axD ? this.axD[this.axD.length - 1] : 100);
    const w = (d) => this.layout(text, { wght, wdth: d, tracking }).width;
    if (w(hi) <= targetUnits) return hi;
    if (w(lo) >= targetUnits) return lo;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      if (w(mid) > targetUnits) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
}

// Draw a single glyph with its baseline-left at (0,0) in the current transform,
// at `size` px per em.
export function fillGlyph(ctx, font, g, size) {
  const s = size / font.upm;
  ctx.save();
  ctx.scale(s, -s);
  ctx.fill(font.path(g));
  ctx.restore();
}

export function strokeGlyph(ctx, font, g, size, lineWidthPx) {
  const s = size / font.upm;
  ctx.save();
  ctx.scale(s, -s);
  ctx.lineWidth = lineWidthPx / s;
  ctx.stroke(font.path(g));
  ctx.restore();
}

export async function loadFont(url) {
  const res = await fetch(url);
  return new OutlineFont(await res.json());
}
