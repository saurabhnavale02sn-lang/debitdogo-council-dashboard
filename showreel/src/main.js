// Boot: load type, build the engine, then either stream frames to the
// renderer (render mode) or play back in real time (preview mode).

import { Engine } from './engine.js';
import { FPS, FRAMES, DURATION } from './config.js';
import { loadFont } from './type.js';
import * as reel from './reel.js';
import { setProfile } from './profile.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'preview';
const res = parseFloat(params.get('res') || (mode === 'render' ? '1' : '0.5'));
// Preview plays in real time with a single sample; render mode uses the reel's
// per-shot motion-blur sample counts unless overridden.
setProfile(params.get('profile') || 'claude');
const samplesOverride = params.has('samples') ? parseInt(params.get('samples'), 10) : mode === 'preview' ? 1 : null;

async function loadFace(family, url, descriptors) {
  const ff = new FontFace(family, `url(${url})`, descriptors);
  await ff.load();
  document.fonts.add(ff);
}

async function boot() {
  document.body.classList.add(mode);
  const [flex, serif] = await Promise.all([
    loadFont('assets/glyphs/roboto-flex.json'),
    loadFont('assets/glyphs/instrument-serif-italic.json'),
    loadFace('JBMono', 'assets/fonts/JetBrainsMono-Variable.woff2', { weight: '100 800' }),
    loadFace('ISerif', 'assets/fonts/InstrumentSerif-Italic.woff2', { style: 'normal' }),
  ]);
  const canvas = document.getElementById('stage');
  const E = new Engine(canvas, { res });
  await reel.init(E, { flex, serif });

  function renderFrame(f) {
    const T = Math.min(f / FPS, DURATION);
    const n = samplesOverride ?? reel.samples(T);
    const shutter = reel.shutter(T);
    E.beginAccum();
    const [lo, hi] = reel.shutterWindow(T, shutter / FPS / 2);
    for (let s = 0; s < n; s++) {
      E.resetPools();
      let t = n === 1 ? T : lo + ((s + 0.5) / n) * (hi - lo);
      t = Math.min(Math.max(t, 0), DURATION - 1e-6);
      const img = reel.composite(E, t, T);
      E.accumulate(img, 1 / n, reel.camera(t));
    }
    E.resetPools();
    const hud = reel.hud(E, T);
    E.finish({ time: T, hud, ...reel.post(T) });
  }
  window.renderFrame = renderFrame;

  if (mode === 'render') {
    const ws = new WebSocket(params.get('ws'));
    ws.binaryType = 'arraybuffer';
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const header = new Int32Array(4);
    window.renderFrames = async (list, { send = true } = {}) => {
      const times = [];
      for (const f of list) {
        const t0 = performance.now();
        renderFrame(f);
        const px = E.readPixels();
        if (!send) { times.push(performance.now() - t0); continue; }
        header[0] = 0x52454c31; header[1] = f; header[2] = E.w; header[3] = E.h;
        const msg = new Uint8Array(16 + px.length);
        msg.set(new Uint8Array(header.buffer), 0);
        msg.set(px, 16);
        ws.send(msg);
        // Backpressure: keep at most ~3 frames in flight.
        while (ws.bufferedAmount > px.length * 3) await new Promise((r) => setTimeout(r, 2));
        times.push(performance.now() - t0);
      }
      while (ws.bufferedAmount > 0) await new Promise((r) => setTimeout(r, 2));
      return times;
    };
    window.ready = true;
    return;
  }

  // ------------------------------------------------------------ preview ---
  const scrub = document.getElementById('scrub');
  const tc = document.getElementById('tc');
  const play = document.getElementById('play');
  scrub.max = FRAMES - 1;
  const audio = new Audio('soundtrack.wav');
  let playing = false;
  let frame = parseInt(params.get('f') || '0', 10);
  const fmt = (f) => {
    const s = Math.floor(f / FPS);
    return `00:00:${String(s).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  };
  const draw = () => {
    renderFrame(frame);
    scrub.value = frame;
    tc.textContent = fmt(frame);
  };
  play.onclick = () => {
    playing = !playing;
    play.textContent = playing ? 'PAUSE' : 'PLAY';
    if (playing) {
      if (frame >= FRAMES - 1) frame = 0;
      audio.currentTime = frame / FPS;
      audio.play().catch(() => {});
      tick();
    } else audio.pause();
  };
  scrub.oninput = () => {
    frame = parseInt(scrub.value, 10);
    if (playing) audio.currentTime = frame / FPS;
    draw();
  };
  const tick = () => {
    if (!playing) return;
    frame = Math.min(FRAMES - 1, Math.round((audio.currentTime || 0) * FPS));
    draw();
    if (audio.ended || frame >= FRAMES - 1) {
      playing = false;
      play.textContent = 'PLAY';
      return;
    }
    requestAnimationFrame(tick);
  };
  draw();
  window.ready = true;
}

boot().catch((e) => {
  console.error(e);
  window.bootError = String(e && e.stack ? e.stack : e);
});
