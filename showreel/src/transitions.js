// Shader transitions between shots.

import { GLSL_HEAD } from './gl.js';

// Tiles of the outgoing shot flip over (with perspective) to reveal the
// incoming shot on their backs, in a diagonal wave. Each pixel tests its own
// cell and neighbours, so tiles that bulge past their cell during the turn
// are drawn correctly.
export const TILEFLIP = GLSL_HEAD + `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uTime;
uniform float uT0;
uniform float uStep;
uniform float uDur;
uniform vec3 uGap;
const float TS = 240.0;
const vec2 ORG = vec2(0.0, -60.0);
const float D = 1100.0;
const float PI = 3.14159265;
float easeIO(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }

void main() {
  vec2 p = designPx(vUv);
  vec2 home = floor((p - ORG) / TS);
  vec4 best = vec4(uGap, 1.0);
  float bestDepth = 1e9;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = home + vec2(float(i), float(j));
      vec2 ctr = ORG + (cell + 0.5) * TS;
      float delay = (cell.x + cell.y) * uStep;
      float pr = clamp((uTime - uT0 - delay) / uDur, 0.0, 1.0);
      float e = easeIO(pr);
      float ang = e * PI;
      float lift = 1.0 + 0.06 * sin(PI * e);
      vec2 q = (p - ctr) / lift;
      float c = cos(ang), s = sin(ang);
      float den = c * D - q.x * s;
      if (abs(den) < 1e-4) continue;
      float u = q.x * D / den;
      float depth = D + u * s;
      if (depth <= 0.0) continue;
      float v = q.y * depth / D;
      if (abs(u) > TS * 0.5 || abs(v) > TS * 0.5) continue;
      if (depth >= bestDepth) continue;
      bestDepth = depth;
      bool front = c >= 0.0;
      vec2 src = ctr + vec2(front ? u : -u, v);
      vec4 tx = front ? texture(uA, uvFromDesign(src)) : texture(uB, uvFromDesign(src));
      float shade = 0.55 + 0.45 * abs(c);
      // a touch of specular sheen as the tile passes edge-on
      float sheen = pow(1.0 - abs(c), 6.0) * 0.25;
      best = vec4(tx.rgb * tx.a * shade + sheen, 1.0);
    }
  }
  outColor = best;
}`;

// Graphic duotone: luminance mapped between two palette colours (sRGB mix).
export const DUOTONE = GLSL_HEAD + `
uniform sampler2D uTex;
uniform vec3 uDark;   // sRGB 0..1
uniform vec3 uLight;  // sRGB 0..1
void main() {
  vec4 c = texture(uTex, vUv);
  vec3 s = toSrgb(c.rgb);
  float l = dot(s, vec3(0.299, 0.587, 0.114));
  l = smoothstep(0.03, 0.8, l);
  outColor = vec4(toLinear(mix(uDark, uLight, l)), 1.0);
}`;

// Digital glitch for hard cuts: displaced horizontal bands + channel split.
export const GLITCH = GLSL_HEAD + `
uniform sampler2D uTex;
uniform float uAmt;
uniform float uSeed;
void main() {
  vec2 p = designPx(vUv);
  float bh = mix(10.0, 90.0, hash12(vec2(floor(p.y / 40.0), uSeed)));
  float band = floor(p.y / bh);
  float r = hash12(vec2(band, uSeed + 3.1));
  float off = r > 0.62 ? (r - 0.62) / 0.38 * (hash12(vec2(band, uSeed + 9.7)) - 0.5) * 2.0 : 0.0;
  off *= uAmt * 150.0;
  float split = uAmt * 14.0;
  vec3 c;
  c.r = texture(uTex, uvFromDesign(p + vec2(off + split, 0.0))).r;
  c.g = texture(uTex, uvFromDesign(p + vec2(off, 0.0))).g;
  c.b = texture(uTex, uvFromDesign(p + vec2(off - split, 0.0))).b;
  outColor = vec4(c, 1.0);
}`;
