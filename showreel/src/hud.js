// Viewfinder HUD: corner marks, timecode, shot slate, tempo pips, progress.
// Drawn once per output frame (no motion blur) on its own layer.

import { W, H, FPS, BEAT, BAR, DURATION } from './config.js';
import { sat, ease, remap } from './math.js';
import { mono, scramble, monoWidth } from './draw.js';
import { P } from './profile.js';

const M = 44; // margin

function tc(T) {
  const f = Math.round(T * FPS);
  const s = Math.floor(f / FPS);
  const fr = f % FPS;
  return `00:00:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
}

// state: { color, alpha, shot: {no, name, t0}, accent }
export function drawHud(L, T, state) {
  const ctx = L.begin();
  const a = state.alpha;
  if (a <= 0.001) return L;
  const col = state.color;
  const intro = ease.outExpo(remap(T, 0.05, 0.6));
  ctx.globalAlpha = a;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 1.5;

  // Corner marks grow out of the corners.
  const arm = 26 * intro;
  const corners = [[M, M, 1, 1], [W - M, M, -1, 1], [M, H - M, 1, -1], [W - M, H - M, -1, -1]];
  ctx.beginPath();
  for (const [x, y, sx, sy] of corners) {
    ctx.moveTo(x + sx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * arm);
  }
  ctx.stroke();

  const fr = Math.round(T * FPS);
  const lp = sat((T - 0.12) / 0.45);
  const top = M + 30, bot = H - M - 18;
  const size = 13;
  const tagX = M + 38 + monoWidth(ctx, P.hud.name, size, 700) + 22;

  // Busy footage gets small ink chips behind the labels so they stay legible.
  if (state.chips > 0.001 && lp > 0) {
    const slate = `${String(state.shot.no).padStart(2, '0')} — ${state.shot.name}`;
    const chip = (x0, x1, y) => {
      ctx.beginPath();
      ctx.roundRect(x0 - 10, y - 17, x1 - x0 + 20, 25, 5);
      ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = a * state.chips * 0.82 * lp;
    ctx.fillStyle = state.chipColor || '#0E0E12';
    chip(M + 38, tagX + monoWidth(ctx, P.hud.tag, size, 400), top);
    chip(W - M - 242, W - M - 38, top);
    chip(M + 38, M + 38 + monoWidth(ctx, slate, size, 600), bot);
    chip(W - M - 110 - monoWidth(ctx, '128 BPM', size, 500), W - M - 28, bot);
    ctx.restore();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
  }

  // Top left: identity.
  mono(ctx, scramble(P.hud.name, lp, 1, fr), M + 38, top, { size, weight: 700, color: col });
  mono(ctx, scramble(P.hud.tag, lp, 2, fr), tagX, top, { size, weight: 400, color: col, alpha: 0.75 });

  // Top right: rec dot + timecode.
  const blink = Math.floor(T / BEAT) % 2 === 0 ? 1 : 0.35;
  if (lp > 0.3) {
    ctx.save();
    ctx.globalAlpha = a * blink;
    ctx.fillStyle = state.accent;
    ctx.beginPath();
    ctx.arc(W - M - 236, top - 5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  mono(ctx, scramble('REC', lp, 3, fr), W - M - 222, top, { size, weight: 700, color: col });
  mono(ctx, lp < 1 ? scramble(tc(T), lp, 4, fr) : tc(T), W - M - 38, top, { size, weight: 500, color: col, align: 'right' });

  // Bottom left: shot slate with scramble on change.
  const sp = sat((T - state.shot.t0) / 0.3);
  const slate = `${String(state.shot.no).padStart(2, '0')} — ${state.shot.name}`;
  mono(ctx, scramble(slate, Math.min(sp, lp), 5 + state.shot.no, fr), M + 38, bot, { size, weight: 600, color: col });

  // Bottom right: tempo pips (the current beat lights up).
  const beatIdx = Math.floor((T + 1e-6) / BEAT) % 4;
  const bp = sat(((T + 1e-6) % BEAT) / 0.12);
  mono(ctx, scramble('128 BPM', lp, 9, fr), W - M - 110, bot, { size, weight: 500, color: col, align: 'right' });
  for (let i = 0; i < 4; i++) {
    const x = W - M - 92 + i * 16;
    const on = i === beatIdx;
    ctx.save();
    ctx.globalAlpha = a * lp;
    if (on) {
      ctx.fillStyle = state.accent;
      const s = 9 + 3 * (1 - bp);
      ctx.fillRect(x + 4.5 - s / 2, bot - 9 - s / 2 + 4.5, s, s);
    } else {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.6, bot - 9 + 0.6, 7.8, 7.8);
    }
    ctx.restore();
  }

  // Progress rule between the bottom labels, ticks at each bar.
  const x0 = M + 300, x1 = W - M - 300, y = bot - 5;
  const pw = (x1 - x0) * intro;
  ctx.save();
  ctx.globalAlpha = a * 0.3;
  ctx.fillRect(x0, y, pw, 1);
  for (let b = 0; b <= 8; b++) ctx.fillRect(x0 + ((x1 - x0) * b) / 8 * intro, y - 3, 1, 7);
  ctx.globalAlpha = a;
  ctx.fillStyle = state.accent;
  ctx.fillRect(x0, y - 1, (x1 - x0) * (T / DURATION) * intro, 3);
  ctx.restore();
  return L;
}

export { tc, BAR };
