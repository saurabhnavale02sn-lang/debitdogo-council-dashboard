// Global constants: canvas, tempo grid, palette.
// The reel is exactly 8 bars at 128 BPM = 15.000 s, so every cut lands on the
// musical grid and the soundtrack (tools/soundtrack.py) shares these numbers.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875 s
export const BAR = BEAT * 4; // 1.875 s
export const BARS = 8;
export const DURATION = BAR * BARS; // 15 s
export const FRAMES = Math.round(DURATION * FPS); // 900

export const beat = (n) => n * BEAT;
export const bar = (n) => n * BAR;

// Palette: a modern Bauhaus set. Ink/paper carry the frame, flame is the
// signature accent, cobalt and sun are supporting pops.
export const C = {
  ink: '#0E0E12',
  ink2: '#17171D',
  paper: '#F2ECE1',
  flame: '#FF4D1C',
  cobalt: '#2B44FF',
  sun: '#FFC53D',
  lilac: '#B9A8FF',
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Linear-light RGB triple for shaders.
export function lin(hex) {
  return hexToRgb(hex).map(srgbToLinear);
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
