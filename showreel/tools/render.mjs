#!/usr/bin/env node
// Render orchestrator.
//
//   node tools/render.mjs serve                      static server for live preview
//   node tools/render.mjs stills 0,120,480 [opts]    PNG stills -> out/stills/
//   node tools/render.mjs sheet [--every 30] [opts]  contact sheet PNG
//   node tools/render.mjs video [opts]               full render -> showreel.mp4
//   node tools/render.mjs bench [--per 6]            per-shot render cost (feeds shot 06)
//
// Options: --res 1  --samples N  --workers 3  --from F --to F  --out path
//
// Each worker is its own headless Chromium (own SwiftShader GPU process), so
// frame ranges render truly in parallel. Frames come back as raw RGBA over a
// WebSocket and are piped straight into ffmpeg.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const FPS = 60;
const FRAMES = 900;

// ------------------------------------------------------------------ args ---
const argv = process.argv.slice(2);
const cmd = argv[0] || 'video';
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes('--' + name);

// ---------------------------------------------------------------- ffmpeg ---
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch {}
  throw new Error('ffmpeg not found: install ffmpeg or `pip install imageio-ffmpeg`, or set FFMPEG');
}
const FFMPEG = findFfmpeg();

function ffmpeg(args, { quiet = true } = {}) {
  const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  p.done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  return p;
}

// ---------------------------------------------------------------- server ---
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.png': 'image/png',
  '.mp4': 'video/mp4', '.css': 'text/css',
};

function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(ROOT)) throw new Error('forbidden');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 * 1024 });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, wss, port: server.address().port })));
}

// --------------------------------------------------------------- workers ---
async function launchWorker(port, id, res, samples, onFrame, wss) {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-background-timer-throttling'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error(`[w${id}] pageerror:`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`[w${id}]`, m.text()); });
  const connected = new Promise((resolve) => {
    const onConn = (sock, req) => {
      if (!req.url.includes(`worker=${id}`)) return;
      wss.off('connection', onConn);
      sock.on('message', (data) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const magic = buf.readInt32LE(0);
        if (magic !== 0x52454c31) return;
        onFrame(buf.readInt32LE(4), buf.readInt32LE(8), buf.readInt32LE(12), buf.subarray(16));
      });
      resolve();
    };
    wss.on('connection', onConn);
  });
  const q = new URLSearchParams({ mode: 'render', res: String(res), ws: `ws://127.0.0.1:${port}/ws?worker=${id}` });
  if (samples) q.set('samples', String(samples));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
  await page.waitForFunction(() => window.ready || window.bootError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.bootError);
  if (err) throw new Error(`worker ${id} boot failed: ${err}`);
  await connected;
  return { browser, page };
}

const fmtTime = (s) => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

// A small render farm: N headless Chromium workers pull jobs (lists of frame
// numbers) from a shared queue, so a slow shot never leaves the others idle.
// Frames stream back over a WebSocket while job completion arrives over CDP;
// a job only counts as done once every one of its frames has landed here.
async function farm({ res, samples, workers, jobs, onJobStart, onFrame, onJobEnd }) {
  const { server, wss, port } = await startServer(0);
  const t0 = Date.now();
  const total = jobs.reduce((a, j) => a + j.length, 0);
  let got = 0;
  const state = [];
  const n = Math.max(1, Math.min(workers, jobs.length));
  const ws = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      launchWorker(port, i, res, samples, (f, w, h, px) => {
        const st = state[i];
        onFrame(st.job, f, w, h, px);
        st.received++;
        got++;
        if (got % 10 === 0 || got === total) {
          const el = (Date.now() - t0) / 1000;
          process.stdout.write(`\r  ${got}/${total} frames  ${fmtTime(el)} elapsed  ~${fmtTime((el / got) * (total - got))} left   `);
        }
        if (st.wake && st.received >= st.expected) st.wake();
      }, wss),
    ),
  );
  const timings = [];
  let next = 0;
  await Promise.all(
    ws.map(async (w, i) => {
      while (next < jobs.length) {
        const k = next++;
        state[i] = { job: k, received: 0, expected: jobs[k].length, wake: null };
        if (onJobStart) await onJobStart(k);
        timings.push(...(await w.page.evaluate((l) => window.renderFrames(l), jobs[k])));
        if (state[i].received < state[i].expected) {
          await new Promise((r) => { state[i].wake = r; });
        }
        if (onJobEnd) await onJobEnd(k);
      }
    }),
  );
  process.stdout.write('\n');
  await Promise.all(ws.map((w) => w.browser.close()));
  server.close();
  if (timings.length) {
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`  in-page render: avg ${avg.toFixed(0)} ms/frame, max ${Math.max(...timings).toFixed(0)} ms`);
  }
}

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// -------------------------------------------------------------- commands ---
async function cmdStills() {
  const list = (argv[1] || '0').split(',').map((s) => parseInt(s, 10));
  const res = parseFloat(opt('res', '1'));
  const samples = opt('samples', null);
  const dir = opt('out', path.join(OUT, 'stills'));
  await mkdir(dir, { recursive: true });
  const jobs = [];
  await farm({
    res, samples, workers: parseInt(opt('workers', '2'), 10), jobs: chunk(list, 1),
    onFrame: (k, f, w, h, px) => {
      const p = ffmpeg(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1',
        path.join(dir, `f${String(f).padStart(4, '0')}.png`)]);
      p.stdin.end(Buffer.from(px));
      jobs.push(p.done);
    },
  });
  await Promise.all(jobs);
  console.log(`  wrote ${list.length} stills to ${path.relative(process.cwd(), dir)}`);
}

async function cmdSheet() {
  const every = parseInt(opt('every', '30'), 10);
  const from = parseInt(opt('from', '0'), 10);
  const to = parseInt(opt('to', String(FRAMES)), 10);
  const res = parseFloat(opt('res', '0.25'));
  const samples = opt('samples', '1');
  const cols = parseInt(opt('cols', '6'), 10);
  const list = [];
  for (let f = from; f < to; f += every) list.push(f);
  const rows = Math.ceil(list.length / cols);
  const w = Math.round(1920 * res), h = Math.round(1080 * res);
  const frames = new Map();
  await farm({
    res, samples, workers: parseInt(opt('workers', '3'), 10), jobs: chunk(list, 4),
    onFrame: (k, f, fw, fh, px) => frames.set(f, Buffer.from(px)),
  });
  const out = opt('out', path.join(OUT, 'sheet.png'));
  await mkdir(path.dirname(out), { recursive: true });
  const p = ffmpeg(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', '1', '-i', '-',
    '-vf', `vflip,pad=iw+4:ih+4:2:2:black,tile=${cols}x${rows}`, '-frames:v', '1', out]);
  for (const f of list) p.stdin.write(frames.get(f));
  const blank = Buffer.alloc(w * h * 4);
  for (let i = list.length; i < cols * rows; i++) p.stdin.write(blank);
  p.stdin.end();
  await p.done;
  console.log(`  wrote ${path.relative(process.cwd(), out)} (${list.length} frames: ${list[0]}..${list[list.length - 1]} every ${every})`);
}

async function cmdVideo() {
  const res = parseFloat(opt('res', '1'));
  const samples = opt('samples', null);
  const workers = parseInt(opt('workers', '3'), 10);
  const from = parseInt(opt('from', '0'), 10);
  const to = parseInt(opt('to', String(FRAMES)), 10);
  const final = res === 1 && !samples && from === 0 && to === FRAMES;
  const out = opt('out', final ? path.join(ROOT, 'showreel.mp4') : path.join(OUT, 'preview.mp4'));
  const audio = opt('audio', path.join(ROOT, 'soundtrack.wav'));
  const tmp = path.join(OUT, 'tmp');
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  const list = [];
  for (let f = from; f < to; f++) list.push(f);
  const w = Math.round(1920 * res), h = Math.round(1080 * res);
  // Small contiguous chunks, each streamed straight into its own
  // near-lossless intermediate, then concatenated in order.
  const jobs = chunk(list, parseInt(opt('chunk', '30'), 10));
  const enc = [];
  const expect = [];
  const name = (k) => `chunk${String(k).padStart(3, '0')}.mkv`;
  const t0 = Date.now();
  await farm({
    res, samples, workers, jobs,
    onJobStart: (k) => {
      expect[k] = jobs[k][0];
      enc[k] = ffmpeg(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
        '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', '-pix_fmt', 'yuv444p', path.join(tmp, name(k))]);
    },
    onFrame: (k, f, fw, fh, px) => {
      if (f !== expect[k]) throw new Error(`chunk ${k}: got frame ${f}, expected ${expect[k]}`);
      expect[k]++;
      enc[k].stdin.write(Buffer.from(px));
    },
    onJobEnd: async (k) => {
      enc[k].stdin.end();
      await enc[k].done;
    },
  });
  console.log(`  rendered ${list.length} frames in ${fmtTime((Date.now() - t0) / 1000)}`);

  const concat = path.join(tmp, 'concat.txt');
  await writeFile(concat, jobs.map((_, k) => `file '${name(k)}'`).join('\n') + '\n');
  const master = path.join(OUT, final ? 'master.mkv' : 'preview-master.mkv');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', master]).done;

  const hasAudio = existsSync(audio) && from === 0;
  const args = ['-i', master];
  if (hasAudio) args.push('-i', audio);
  // CRF 18 / tune film keeps the grain's texture at ~27 MB; tune grain at
  // CRF 14 is visually identical here but ~170 MB.
  args.push('-c:v', 'libx264', '-preset', final ? 'slow' : 'veryfast', '-crf', opt('crf', final ? '18' : '20'),
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'film', '-movflags', '+faststart',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv');
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
  args.push(out);
  await ffmpeg(args).done;
  await rm(tmp, { recursive: true, force: true });
  const s = await stat(out);
  console.log(`  wrote ${path.relative(process.cwd(), out)} (${(s.size / 1e6).toFixed(1)} MB${hasAudio ? ', with audio' : ''})`);
}

// Measure real in-page render cost per shot (single worker, full settings,
// no transfer) — these numbers feed the chart in shot 06.
async function cmdBench() {
  const per = parseInt(opt('per', '6'), 10);
  const names = ['IGN', 'TYPE', 'GEO', 'PART', 'DIM', 'DATA', 'MONT', 'SIGN'];
  const list = [];
  for (let s = 0; s < 8; s++) {
    const a = Math.round(s * 112.5), b = Math.round((s + 1) * 112.5);
    for (let k = 0; k < per; k++) list.push(Math.round(a + ((k + 0.5) * (b - a)) / per));
  }
  const { server, wss, port } = await startServer(0);
  const w = await launchWorker(port, 0, 1, opt('samples', null), () => {}, wss);
  await w.page.evaluate((l) => window.renderFrames(l, { send: false }), list.slice(0, 3)); // warm up
  const times = await w.page.evaluate((l) => window.renderFrames(l, { send: false }), list);
  await w.browser.close();
  server.close();
  const out = [];
  for (let s = 0; s < 8; s++) {
    const t = times.slice(s * per, (s + 1) * per);
    out.push(Math.round(t.reduce((x, y) => x + y, 0) / t.length));
  }
  console.log(names.map((n, i) => `${n} ${out[i]}`).join('  '));
  console.log(`STATS = [${out.join(', ')}]`);
}

async function cmdServe() {
  const { port } = await startServer(parseInt(opt('port', '8080'), 10));
  console.log(`preview: http://127.0.0.1:${port}/index.html  (?f=frame to jump, ?res=1 for full res)`);
}

const commands = { stills: cmdStills, sheet: cmdSheet, video: cmdVideo, serve: cmdServe, bench: cmdBench };
if (!commands[cmd]) {
  console.error(`unknown command ${cmd}; expected one of ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
commands[cmd]().catch((e) => {
  console.error(e);
  process.exit(1);
});
