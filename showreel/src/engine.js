// Frame engine: CPU-rasterised 2D layers + GL shader layers composited in
// linear light, true motion blur by accumulating sub-frames in a float
// buffer, then a single post pass (bloom, lens, grain, dither).

import { GL, GLSL_HEAD } from './gl.js';
import { W, H } from './config.js';

const BLIT = GLSL_HEAD + `
uniform sampler2D uTex;
uniform float uOpacity;
void main() {
  vec4 c = texture(uTex, vUv);           // sRGB-decoded, straight alpha
  outColor = vec4(c.rgb * c.a, c.a) * uOpacity;
}`;

// Premultiplied linear texture with a design-space affine transform.
const BLIT_T = GLSL_HEAD + `
uniform sampler2D uTex;
uniform float uOpacity;
uniform mat3 uM;       // output design px -> source design px
void main() {
  vec2 q = (uM * vec3(designPx(vUv), 1.0)).xy;
  vec2 uv = uvFromDesign(q);
  vec4 c = texture(uTex, uv);
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  outColor = c * uOpacity * inb.x * inb.y;
}`;

const FILL = GLSL_HEAD + `
uniform vec4 uColor;
void main() { outColor = uColor; }`;

const ACCUM = GLSL_HEAD + `
uniform sampler2D uTex;
uniform float uWeight;
uniform float uStraight;   // 1: sRGB layer texture with straight alpha
uniform mat3 uM;
void main() {
  vec2 q = (uM * vec3(designPx(vUv), 1.0)).xy;
  vec4 c = texture(uTex, uvFromDesign(q));
  if (uStraight > 0.5) c.rgb *= c.a;
  outColor = c * uWeight;
}`;

const BLOOM_PRE = GLSL_HEAD + `
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(uThreshold, uThreshold + 0.35, l);
  outColor = vec4(c * k, 1.0);
}`;

const BLOOM_DOWN = GLSL_HEAD + `
uniform sampler2D uTex;
uniform vec2 uTexel;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 4.0;
  c += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  outColor = vec4(c / 8.0, 1.0);
}`;

const BLOOM_UP = GLSL_HEAD + `
uniform sampler2D uTex;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uTex, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 2.0, 0.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(0.0, -2.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(0.0,  2.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
  c += texture(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb * 2.0;
  c += texture(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb * 2.0;
  c += texture(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb * 2.0;
  outColor = vec4(c / 12.0, 1.0);
}`;

const FINAL = GLSL_HEAD + `
uniform sampler2D uAccum;
uniform sampler2D uBloom;
uniform sampler2D uHud;
uniform float uTime;
uniform float uCA;
uniform float uBloomAmt;
uniform float uGrain;
uniform float uVignette;
uniform vec4 uFlash;       // rgb (linear), amount
uniform float uHudOn;

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  d.x *= DESIGN.x / DESIGN.y;
  float r2 = dot(d, d);
  vec2 off = (uv - 0.5) * uCA * (0.35 + r2);
  vec3 col;
  col.r = texture(uAccum, uv - off).r;
  col.g = texture(uAccum, uv).g;
  col.b = texture(uAccum, uv + off).b;
  col += texture(uBloom, uv).rgb * uBloomAmt;
  col = mix(col, uFlash.rgb, uFlash.a);
  col *= 1.0 - uVignette * smoothstep(0.35, 1.25, sqrt(r2) * 1.25);
  if (uHudOn > 0.5) {
    vec4 h = texture(uHud, uv);
    col = mix(col, h.rgb, h.a);
  }
  vec3 s = toSrgb(col);
  // Film grain: soft ~1.4px grains, stronger in the mids, re-seeded per frame.
  vec2 gp = gl_FragCoord.xy / 1.4 + vec2(fract(uTime * 13.7) * 311.0, fract(uTime * 7.3) * 197.0);
  float g = vnoise(gp) + vnoise(gp * 1.9 + 17.0) - 1.0;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  s += g * uGrain * (0.55 + 0.9 * lum * (1.0 - lum));
  // Triangular dither to kill banding in the 8-bit output.
  float dth = hash12(gl_FragCoord.xy + fract(uTime * 3.1) * 97.0) + hash12(gl_FragCoord.xy * 1.31 + 7.0) - 1.0;
  s += dth / 255.0;
  outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

export class Layer {
  constructor(engine) {
    this.engine = engine;
    this.canvas = new OffscreenCanvas(engine.w, engine.h);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.tex = engine.g.canvasTexture();
  }
  begin(fill = null) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.identity();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    return ctx;
  }
  // Base transform: design px, y-flipped so the raster uploads to GL
  // right side up. Scenes must use save/translate/scale, never setTransform.
  identity() {
    const r = this.engine.res;
    this.ctx.setTransform(r, 0, 0, -r, 0, this.canvas.height);
  }
  upload() {
    this.engine.g.upload(this.tex, this.canvas);
    return this.tex;
  }
}

export class Engine {
  constructor(canvas, { res = 1 } = {}) {
    this.res = res;
    this.w = Math.round(W * res);
    this.h = Math.round(H * res);
    canvas.width = this.w;
    canvas.height = this.h;
    this.g = new GL(canvas);
    const g = this.g;
    this.p = {
      blit: g.program('blit', BLIT),
      blitT: g.program('blitT', BLIT_T),
      fill: g.program('fill', FILL),
      accum: g.program('accum', ACCUM),
      bloomPre: g.program('bloomPre', BLOOM_PRE),
      bloomDown: g.program('bloomDown', BLOOM_DOWN),
      bloomUp: g.program('bloomUp', BLOOM_UP),
      final: g.program('final', FINAL),
    };
    this.pool = [];
    this.poolIdx = 0;
    this.rts = [];
    this.rtIdx = 0;
    this.accum = g.target(this.w, this.h);
    this.bloom = [];
    let bw = this.w >> 1, bh = this.h >> 1;
    for (let i = 0; i < 5; i++) {
      this.bloom.push(g.target(Math.max(bw, 1), Math.max(bh, 1)));
      bw >>= 1;
      bh >>= 1;
    }
    this.hud = new Layer(this);
    this.pixels = new Uint8Array(this.w * this.h * 4);
  }

  // Pooled 2D layer, cleared, transform in design px.
  layer(fill = null) {
    if (this.poolIdx >= this.pool.length) this.pool.push(new Layer(this));
    const L = this.pool[this.poolIdx++];
    L.begin(fill);
    return L;
  }

  // Pooled float render target.
  rt() {
    if (this.rtIdx >= this.rts.length) this.rts.push(this.g.target(this.w, this.h));
    return this.rts[this.rtIdx++];
  }

  resetPools() {
    this.poolIdx = 0;
    this.rtIdx = 0;
  }

  clear(target, rgba = [0, 0, 0, 0]) {
    this.g.clear(target, rgba);
  }

  fill(target, linRgb, a = 1) {
    this.g.pass(this.p.fill, { uColor: [linRgb[0] * a, linRgb[1] * a, linRgb[2] * a, a] }, target, 'over');
  }

  // Upload a 2D layer and composite it over `target`.
  drawLayer(L, target, opacity = 1) {
    const tex = L.upload();
    this.g.pass(this.p.blit, { uTex: tex, uOpacity: opacity }, target, 'over');
  }

  // Composite a premultiplied render target over `target` with transform.
  drawRT(src, target, { opacity = 1, m = IDENT } = {}) {
    this.g.pass(this.p.blitT, { uTex: src.tex, uOpacity: opacity, uM: m }, target, 'over');
  }

  shader(prog, uniforms, target, blend = 'over') {
    this.g.pass(prog, { uRes: [this.w, this.h], ...uniforms }, target, blend);
  }

  beginAccum() {
    this.g.clear(this.accum, [0, 0, 0, 0]);
  }

  // src: a float render target, or an opaque 2D Layer (uploaded here).
  accumulate(src, weight, m = IDENT) {
    const isLayer = src instanceof Layer;
    const tex = isLayer ? src.upload() : src.tex;
    this.g.pass(this.p.accum, { uTex: tex, uWeight: weight, uM: m, uStraight: isLayer ? 1 : 0 }, this.accum, 'add');
  }

  // Post + present to the default framebuffer.
  finish({ time, ca = 0, bloom = 0.0, threshold = 0.8, grain = 0.03, vignette = 0.25, flash = [1, 1, 1, 0], hud = null }) {
    const g = this.g;
    if (bloom > 0) {
      const b = this.bloom;
      g.pass(this.p.bloomPre, { uTex: this.accum.tex, uTexel: [1 / this.w, 1 / this.h], uThreshold: threshold }, b[0]);
      for (let i = 1; i < b.length; i++) {
        g.pass(this.p.bloomDown, { uTex: b[i - 1].tex, uTexel: [1 / b[i - 1].w, 1 / b[i - 1].h] }, b[i]);
      }
      for (let i = b.length - 1; i > 0; i--) {
        g.pass(this.p.bloomUp, { uTex: b[i].tex, uTexel: [0.5 / b[i].w, 0.5 / b[i].h] }, b[i - 1], 'add');
      }
    }
    let hudTex = this.bloom[0].tex;
    if (hud) hudTex = hud.upload();
    g.pass(
      this.p.final,
      {
        uAccum: this.accum.tex,
        uBloom: this.bloom[0].tex,
        uHud: hudTex,
        uTime: time,
        uCA: ca,
        uBloomAmt: bloom,
        uGrain: grain,
        uVignette: vignette,
        uFlash: flash,
        uHudOn: hud ? 1 : 0,
      },
      null,
    );
  }

  readPixels() {
    const gl = this.g.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.w, this.h, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    return this.pixels;
  }
}

export const IDENT = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

// 2D camera (design px): output point p maps to source point
// c + R(-rot) * (p - c - shake) / zoom. Returned as column-major mat3.
export function camMatrix({ zoom = 1, rot = 0, cx = W / 2, cy = H / 2, dx = 0, dy = 0 } = {}) {
  const cs = Math.cos(-rot) / zoom;
  const sn = Math.sin(-rot) / zoom;
  // q = R*(p - c - d)/zoom + c
  const tx = -(cs * (cx + dx) - sn * (cy + dy)) + cx;
  const ty = -(sn * (cx + dx) + cs * (cy + dy)) + cy;
  return new Float32Array([cs, sn, 0, -sn, cs, 0, tx, ty, 1]);
}
