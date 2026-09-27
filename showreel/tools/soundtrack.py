#!/usr/bin/env python3
"""Procedural soundtrack for the reel: 128 BPM, 8 bars = exactly 15.000 s.

Every sound is synthesised here (no samples) and placed on the same grid the
renderer uses, so each visual event has its own sound: the dot's blip, clock
ticks under "TIMING", a card-shuffle for the tile flip, the particle burst,
the chrome's metallic hit, odometer clicks, the toggle, glitch stutters, the
breath before the last downbeat and the sonic-logo ping.

    python3 tools/soundtrack.py            # -> soundtrack.wav
"""
import os

import numpy as np
from scipy import signal

SR = 48000
BPM = 128
BEAT = 60 / BPM          # 0.46875 s  (22500 samples)
BAR = 4 * BEAT           # 1.875 s
E8, E16 = BEAT / 2, BEAT / 4
DUR = 8 * BAR            # 15.0 s
N = int(round(DUR * SR))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(128)


# ------------------------------------------------------------------ utils ---
def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def n(name):
    """'A3' -> midi number."""
    return NOTE[name[:-1]] + 12 * (int(name[-1]) + 1)


def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def env_exp(dur, decay, attack=0.002):
    t = tt(dur)
    a = np.clip(t / max(attack, 1e-5), 0, 1)
    return a * np.exp(-t / decay)


def adsr(dur, a, d, s, r):
    t = tt(dur)
    e = np.where(t < a, t / max(a, 1e-5), 1.0)
    e = np.where(t >= a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-5)), e)
    rel = dur - r
    e = np.where(t > rel, e * np.clip((dur - t) / max(r, 1e-5), 0, 1), e)
    return e


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def sweep_filter(x, f0, f1, kind='low', q=0.9, block=256, curve='exp'):
    """Time-varying resonant biquad (RBJ), coefficients updated per block."""
    y = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    z = np.zeros(2)
    for i in range(nb):
        u = i / max(nb - 1, 1)
        fc = f0 * (f1 / f0) ** u if curve == 'exp' else f0 + (f1 - f0) * u
        w0 = 2 * np.pi * min(fc, SR * 0.45) / SR
        alpha = np.sin(w0) / (2 * q)
        c = np.cos(w0)
        if kind == 'low':
            b = np.array([(1 - c) / 2, 1 - c, (1 - c) / 2])
        elif kind == 'high':
            b = np.array([(1 + c) / 2, -(1 + c), (1 + c) / 2])
        else:  # band
            b = np.array([alpha, 0, -alpha])
        a = np.array([1 + alpha, -2 * c, 1 - alpha])
        seg = x[i * block:(i + 1) * block]
        out, z = signal.lfilter(b / a[0], a / a[0], seg, zi=z)
        y[i * block:(i + 1) * block] = out
    return y


def saw(freq, dur, phase=None):
    """PolyBLEP band-limited saw. freq may be a scalar or a per-sample array."""
    t = tt(dur)
    f = np.broadcast_to(np.asarray(freq, dtype=float), t.shape)
    ph = np.cumsum(f / SR) + (rng.random() if phase is None else phase)
    p = ph % 1.0
    dt = f / SR
    blep = np.zeros_like(p)
    m1 = p < dt
    x = p[m1] / dt[m1]
    blep[m1] = x + x - x * x - 1
    m2 = p > 1 - dt
    x = (p[m2] - 1) / dt[m2]
    blep[m2] = x * x + x + x + 1
    return (2 * p - 1) - blep


def sine(freq, dur, phase=0.0):
    t = tt(dur)
    f = np.broadcast_to(np.asarray(freq, dtype=float), t.shape)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def noise(dur):
    return rng.standard_normal(len(tt(dur)))


def pan(x, p):
    """Equal-power pan, p in [-1, 1] (scalar or array) -> stereo (N,2)."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=-1)


def db(v):
    return 10 ** (v / 20)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, t0, sig, gain=1.0, p=0.0):
        if sig.ndim == 1:
            sig = pan(sig, p)
        f = min(int(0.006 * SR), len(sig))
        if f > 1:
            sig = sig.copy()
            sig[-f:] *= np.linspace(1, 0, f)[:, None]
        i0 = int(round(t0 * SR))
        if i0 >= N:
            return
        if i0 < 0:
            sig = sig[-i0:]
            i0 = 0
        m = min(len(sig), N - i0)
        self.x[i0:i0 + m] += sig[:m] * gain


# ------------------------------------------------------------ instruments ---
def kick(big=1.0):
    """Tuned so it still reads on small speakers: a tight 50 Hz body, a
    100-200 Hz punch layer and a bright click."""
    d = 0.5 if big <= 1 else 1.6
    t = tt(d)
    f = 50 + 120 * np.exp(-t / 0.028) + 90 * np.exp(-t / 0.005)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.14 if big <= 1 else 0.45))
    pf = 95 + 110 * np.exp(-t / 0.02)
    punch = np.sin(2 * np.pi * np.cumsum(pf) / SR) * np.exp(-t / 0.045) * 0.55
    click = hp(noise(0.018), 2800) * env_exp(0.018, 0.004) * 0.45
    x = body + punch
    x[: len(click)] += click
    return np.tanh(1.5 * x * min(big, 1.4)) * 0.95


def clap():
    x = np.zeros(len(tt(0.35)))
    for k, d in enumerate([0, 0.011, 0.023]):
        b = bp(noise(0.35), 900, 3200) * env_exp(0.35, 0.006 if k < 2 else 0.11)
        i = int(d * SR)
        x[i:] += b[: len(x) - i]
    return x * 0.5


def hat(open_=False):
    d = 0.3 if open_ else 0.06
    x = hp(noise(d), 7500, 3) * env_exp(d, 0.09 if open_ else 0.018)
    # metallic partials
    t = tt(d)
    m = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3140, 4410, 5860, 7120)) * 0.05
    return (x + hp(m, 6000) * env_exp(d, 0.02)) * 0.35


def crash(d=2.2):
    x = hp(noise(d), 3500, 2) * env_exp(d, 0.7, 0.001)
    t = tt(d)
    m = sum(np.sign(np.sin(2 * np.pi * f * t + rng.random() * 6)) for f in (2180, 2930, 3810, 4770, 6210)) * 0.06
    x += hp(m, 3000) * env_exp(d, 0.45)
    return x * 0.45


def tick(freq=3200, d=0.03):
    t = tt(d)
    x = np.sin(2 * np.pi * freq * t) * env_exp(d, 0.004, 0.0003)
    x += hp(noise(d), 5000) * env_exp(d, 0.002, 0.0002) * 0.6
    return x * 0.6


def pop(f0=1400, f1=180, d=0.09):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.012)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, 0.03, 0.001) * 0.8


def bell(freq, d=2.0, index=3.0, ratio=3.5, decay=0.6):
    t = tt(d)
    mod = np.sin(2 * np.pi * freq * ratio * t) * index * np.exp(-t / (decay * 0.5))
    car = np.sin(2 * np.pi * freq * t + mod)
    car += 0.3 * np.sin(2 * np.pi * freq * 2.001 * t + mod * 0.5)
    return car * env_exp(d, decay, 0.002) * 0.5


def pluck(freq, d=0.35, bright=4000):
    x = saw(freq, d) * 0.6 + saw(freq * 1.005, d) * 0.4
    y = sweep_filter(x, bright, 400, 'low', q=1.2)
    return y * env_exp(d, 0.18, 0.002) * 0.5


def supersaw(freqs, d, voices=7, detune=0.18):
    out = np.zeros((len(tt(d)), 2))
    for f in freqs:
        for v in range(voices):
            dt = (v - (voices - 1) / 2) / ((voices - 1) / 2)
            ff = f * 2 ** (dt * detune / 12)
            s = saw(ff, d)
            out += pan(s, dt * 0.8) / voices
    return out / max(len(freqs), 1)


def whoosh(d=0.5, f0=400, f1=4000, p0=-0.8, p1=0.8, q=1.4):
    x = noise(d)
    y = sweep_filter(x, f0, f1, 'band', q=q)
    e = np.sin(np.pi * np.clip(tt(d) / d, 0, 1)) ** 1.5
    return pan(y * e * 0.9, np.linspace(p0, p1, len(y)))


def riser(d=1.5, f0=200, f1=6000):
    x = noise(d)
    y = sweep_filter(x, f0, f1, 'band', q=2.0)
    t = tt(d)
    tone = saw(np.geomspace(110, 880, len(t)), d) * 0.15
    tone = sweep_filter(tone, 300, 5000, 'low')
    e = (t / d) ** 2
    return (y * 0.8 + tone) * e


def subdrop(d=1.2, f0=90, f1=32):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * env_exp(d, 0.45, 0.004) * 0.9


def sparkle(d=1.0, count=90):
    x = np.zeros(len(tt(d)))
    for _ in range(count):
        t0 = rng.exponential(d * 0.25)
        if t0 > d - 0.05:
            continue
        f = rng.choice([midi(n('A6')), midi(n('C7')), midi(n('E7')), midi(n('G6')), midi(n('B6'))]) * (1 + rng.normal() * 0.002)
        g = sine(f, 0.12) * env_exp(0.12, 0.03, 0.001) * rng.uniform(0.2, 1.0)
        i = int(t0 * SR)
        x[i:i + len(g)] += g[: len(x) - i]
    return x * 0.18


def glitch(d=0.07, seed=0):
    r = np.random.default_rng(seed)
    x = noise(d) * 0.5
    # sample-and-hold decimation + bitcrush
    hold = r.integers(6, 30)
    x = np.repeat(x[::hold], hold)[: len(tt(d))]
    x = np.round(x * 6) / 6
    x = bp(x, 300, 9000)
    stutter = (np.floor(tt(d) / 0.012) % 2 == 0).astype(float)
    return x * stutter * env_exp(d, 0.05, 0.0005) * 0.8


def reverse_crash(d=1.2):
    return crash(d)[::-1] * np.linspace(0, 1, len(tt(d))) ** 2


# ------------------------------------------------------------------ reverb ---
def reverb(x, seconds=2.2, predelay=0.02, damp=6000, wet=1.0):
    ln = int(seconds * SR)
    t = np.arange(ln) / SR
    ir = np.zeros((ln, 2))
    for ch in range(2):
        nz = rng.standard_normal(ln) * np.exp(-t / (seconds / 6.9))
        nz = lp(nz, damp)
        ir[:, ch] = nz
    pd = int(predelay * SR)
    ir = np.vstack([np.zeros((pd, 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    out = np.zeros_like(x)
    for ch in range(2):
        out[:, ch] = signal.fftconvolve(x[:, ch], ir[:, ch])[: len(x)]
    return out * wet


# -------------------------------------------------------------- the score ---
CHORDS = [  # (bass root, voicing) per bar
    ('A1', ['A3', 'C4', 'E4', 'G4', 'B4']),   # Am9   — ignition (intro)
    ('F1', ['F3', 'A3', 'C4', 'E4', 'G4']),   # Fmaj9 — the drop
    ('G1', ['G3', 'B3', 'D4', 'E4', 'A4']),   # G6/9
    ('E1', ['E3', 'G3', 'B3', 'D4', 'F#4']),  # Em9
    ('A1', ['A3', 'C4', 'E4', 'G4', 'B4']),   # Am9   — chrome
    ('F1', ['F3', 'A3', 'C4', 'E4', 'G4']),   # Fmaj9 — data
    ('G1', ['G3', 'B3', 'D4', 'A4', 'D5']),   # Gsus  — build
    ('A1', ['A3', 'C4', 'E4', 'B4', 'E5']),   # Am(add9) — signature
]


def build():
    drums, bass, music, fx, verb_send = Bus(), Bus(), Bus(), Bus(), Bus()
    kicks = []

    # ---------------- bar 1: IGNITION (no kick; clock ticks, pad swells)
    fx.add(0.0, bell(midi(n('A6')), 1.2, index=1.5, ratio=2.0, decay=0.25), db(-10))   # the point
    fx.add(0.0, pop(2200, 400, 0.05), db(-10))
    verb_send.add(0.0, bell(midi(n('A6')), 1.2, index=1.5, ratio=2.0, decay=0.25), db(-12))
    for k in range(4):  # tick-tock on the beat: timing is everything
        drums.add(k * BEAT, tick(3400 if k % 2 == 0 else 2600), db(-12), p=-0.3 if k % 2 else 0.3)
    for k in range(8, 16):
        drums.add(k * E16, hat(), db(-26 + (k - 8) * 1.2), p=0.25)
    fx.add(BEAT - 0.02, whoosh(0.42, 600, 5000, -0.7, 0.7), db(-12))        # point -> line
    fx.add(2 * BEAT, tick(1800, 0.02), db(-8))                               # slit opens
    fx.add(2 * BEAT, whoosh(0.3, 3000, 900, 0.2, -0.2, q=2.0), db(-16))
    fx.add(3 * BEAT - 0.01, pluck(midi(n('E5')), 0.3, 6000), db(-14), p=-0.3)  # weight ripple
    fx.add(3 * BEAT + E16, pluck(midi(n('G5')), 0.3, 6000), db(-15), p=0.3)
    fx.add(BAR - 1.3, riser(1.3, 250, 9000), db(-9))                          # the dive
    fx.add(BAR - 1.2, reverse_crash(1.2), db(-12))
    pad1 = supersaw([midi(n(x)) for x in CHORDS[0][1]], BAR + 0.1)
    pad1 = np.stack([sweep_filter(pad1[:, c], 250, 2400, 'low', q=1.1) for c in range(2)], axis=-1)
    music.add(0.0, pad1 * adsr(BAR + 0.1, 0.6, 1, 1, 0.1)[:, None], db(-15))

    # ---------------- bars 2..6: the groove
    for b in range(1, 6):
        t0 = b * BAR
        for k in range(4):
            kicks.append(t0 + k * BEAT)
            drums.add(t0 + k * BEAT, kick(), db(-6))
            if k in (1, 3):
                drums.add(t0 + k * BEAT, clap(), db(-9), p=0.05)
                verb_send.add(t0 + k * BEAT, pan(clap(), 0), db(-14))
            drums.add(t0 + k * BEAT + E8, hat(), db(-10), p=0.35)
            drums.add(t0 + k * BEAT + E16 * 3, hat(), db(-19), p=-0.35)
        drums.add(t0 + 3 * BEAT + E8, hat(True), db(-17), p=0.4)
        # chord stabs + sustained pad
        root, voicing = CHORDS[b]
        fr = [midi(n(x)) for x in voicing]
        for k, pos in enumerate([0, 1.5, 2.5, 3.5]):
            d = 0.28 if k else 0.5
            st = supersaw(fr, d, voices=5, detune=0.12)
            st = np.stack([sweep_filter(st[:, c], 5200, 700, 'low', q=1.0) for c in range(2)], axis=-1)
            music.add(t0 + pos * BEAT, st * env_exp(d, 0.16 if k else 0.3)[:, None], db(-12 if k == 0 else -15))
        pad = supersaw(fr, BAR)
        pad = np.stack([lp(pad[:, c], 1800) for c in range(2)], axis=-1)
        music.add(t0, pad * adsr(BAR, 0.08, 0.5, 0.8, 0.12)[:, None], db(-21))
        # off-beat house bass: one note on every "&", with a clean sine sub
        f = midi(n(root))
        for k in range(4):
            d = E8 * 0.92
            mult = 4 if (b + k) % 4 == 3 else 2   # an octave lift for movement
            x = saw(f * mult, d) * 0.55 + saw(f * mult * 1.004, d) * 0.35
            x = sweep_filter(x, 1400, 380, 'low', q=1.3) * adsr(d, 0.004, 0.08, 0.6, 0.03)
            sub = sine(f * 2, d) * adsr(d, 0.006, 0.1, 0.8, 0.04)
            bass.add(t0 + k * BEAT + E8, x * 0.85 + sub * 0.4, db(-14))

    # ---------------- bar 2: TYPE (events)
    t2 = BAR
    drums.add(t2, crash(), db(-9))
    fx.add(t2, subdrop(1.0), db(-10))
    for i in range(6):  # six letters land
        fx.add(t2 + i * 0.034, tick(1100 + 90 * i, 0.04), db(-11), p=-0.6 + i * 0.24)
    fx.add(t2 + BEAT, pop(1600, 220, 0.1), db(-8))                                  # "is"
    fx.add(t2 + 2 * BEAT - 0.03, whoosh(0.45, 5000, 700, 0.9, -0.6), db(-11))       # EVERYTHING slides in
    fx.add(t2 + 3 * BEAT, pop(900, 120, 0.12), db(-7))                              # the full stop lands
    fx.add(t2 + 3 * BEAT, bell(midi(n('E6')), 1.0, index=1.2, ratio=2.0, decay=0.2), db(-15))
    flip_t0, step, dur = 2 * BAR - 0.26, 0.026, 0.24
    for k in range(12):  # tile flip: a card-shuffle per diagonal
        fx.add(flip_t0 + k * step + dur * 0.5, tick(1500 + 70 * k, 0.025), db(-14), p=-0.8 + k * 0.14)

    # ---------------- bar 3: GEOMETRY
    t3 = 2 * BAR
    drums.add(t3, crash(1.4), db(-14))
    for k in range(10):  # rotation wave
        fx.add(t3 + BEAT - 0.04 + k * 0.028, tick(2000 + 60 * k, 0.02), db(-19), p=-0.7 + k * 0.15)
    fx.add(t3 + BEAT, whoosh(0.34, 800, 3000, -0.5, 0.5), db(-16))
    inv = bell(midi(n('A5')), 0.8, index=2.0, ratio=1.5, decay=0.2) + bell(midi(n('E6')), 0.8, index=2.0, ratio=1.5, decay=0.2)
    fx.add(t3 + 2 * BEAT, inv, db(-14))                                             # inversion wave
    fx.add(t3 + 3 * BEAT - 0.05, riser(0.52, 400, 7000), db(-14))                    # collapse

    # ---------------- bar 4: PARTICLES
    t4 = 3 * BAR
    fx.add(t4, subdrop(1.3, 110, 34), db(-9))
    drums.add(t4, crash(2.4), db(-8))
    sp = sparkle(1.6, 140)
    fx.add(t4, pan(sp, 0.0) + pan(np.roll(sp, 1500), 0.5) * 0.6, db(-6))
    for k in range(16):  # shimmering arp
        note = ['A5', 'C6', 'E6', 'B5', 'G5', 'E6', 'D6', 'B5'][k % 8]
        fx.add(t4 + k * E16, pluck(midi(n(note)), 0.25, 7000), db(-19 - (k % 2) * 2), p=np.sin(k) * 0.6)
    fx.add(t4 + 1.85 * BEAT, whoosh(1.2, 300, 3000, 0.8, -0.8, q=1.0), db(-13))          # gather
    fx.add(t4 + 3 * BEAT, riser(BEAT, 800, 8000), db(-15))

    # ---------------- bar 5: DIMENSION
    t5 = 4 * BAR
    chrome = bell(midi(n('A4')), 2.5, index=5.0, ratio=1.41, decay=0.9) + bell(midi(n('E5')), 2.5, index=4.0, ratio=2.76, decay=0.7)
    fx.add(t5, chrome, db(-9))
    verb_send.add(t5, pan(chrome, 0), db(-10))
    drums.add(t5, crash(1.8), db(-11))
    for k in range(1, 4):  # metallic pings on each beat (the blob pulses)
        fx.add(t5 + k * BEAT, bell(midi(n(['C6', 'B5', 'G5'][k - 1])), 0.6, index=2.5, ratio=3.1, decay=0.15), db(-17), p=[-0.4, 0.4, 0][k - 1])
    for i in range(8):  # the wipe: eight columns, an ascending strum
        end = 5 * BAR - (7 - i) * 0.02
        fx.add(end - 0.06, pluck(midi(n(['A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6'][i])), 0.4, 8000), db(-15), p=-0.8 + i * 0.23)

    # ---------------- bar 6: DATA
    t6 = 5 * BAR
    for i in range(8):  # bars settle
        fx.add(t6 + 0.31 + i * 0.028, pop(700 + 60 * i, 200, 0.06), db(-17), p=-0.7 + i * 0.2)
    last = -1
    for s in range(int(0.9 * SR / 64)):
        tau = 0.3 + s * 64 / SR
        v = 900 * (1 - 2 ** (-10 * min(max((tau - 0.3) / 0.75, 0), 1)))
        tens = int(v // 10)
        if tens != last and tau < 1.1:
            fx.add(t6 + tau, tick(4200, 0.012), db(-24), p=0.55)   # odometer
            last = tens
    fx.add(t6 + 2 * BEAT - 0.08, whoosh(0.34, 1500, 6000, 0.3, 0.6, q=2.2), db(-17))   # ring draws
    fx.add(t6 + 2 * BEAT + 0.26, bell(midi(n('E6')), 0.9, index=1.0, ratio=2.0, decay=0.25), db(-14), p=0.4)
    fx.add(t6 + 3 * BEAT, tick(900, 0.03), db(-6), p=0.4)                               # click
    fx.add(t6 + 3 * BEAT + 0.02, bell(midi(n('A6')), 0.7, index=0.8, ratio=2.0, decay=0.15), db(-13), p=0.4)

    # ---------------- bar 7: MONTAGE (build)
    t7 = 6 * BAR
    cuts = [0, E8, 2 * E8, 3 * E8] + [2 * BEAT + k * E16 for k in range(6)]
    for k, c in enumerate(cuts):
        fx.add(t7 + c, glitch(0.08, k), db(-12), p=(-1) ** k * 0.4)
    for k in range(4):
        kicks.append(t7 + k * BEAT)
        drums.add(t7 + k * BEAT, kick(), db(-6.5))
    for k in range(6):  # snare roll on the 16th type cuts
        drums.add(t7 + 2 * BEAT + k * E16, clap(), db(-13 + k * 1.3))
    for k in range(7):
        drums.add(t7 + k * E8 + E16, hat(), db(-16), p=0.3)
    root, voicing = CHORDS[6]
    fr = [midi(n(x)) for x in voicing]
    build_pad = supersaw(fr, 1.64)
    build_pad = np.stack([sweep_filter(build_pad[:, c], 500, 9000, 'low', q=1.4) for c in range(2)], axis=-1)
    music.add(t7, build_pad * np.linspace(0.5, 1, len(build_pad))[:, None], db(-14))
    fx.add(t7, riser(1.64, 300, 12000), db(-9))
    for k in range(7):
        f = midi(n(root)) * 2
        x = lp(saw(f, E8 * 0.9) * 0.6, 900) * adsr(E8 * 0.9, 0.003, 0.05, 0.7, 0.02)
        x += sine(f, E8 * 0.9) * adsr(E8 * 0.9, 0.006, 0.1, 0.8, 0.03) * 0.4
        bass.add(t7 + k * E8, x, db(-12))
    # the breath: everything stops at the point (t7 + 1.64); a tiny tick only
    fx.add(t7 + 1.64, tick(5200, 0.02), db(-16))

    # ---------------- bar 8: SIGNATURE
    t8 = 7 * BAR
    drums.add(t8, kick(1.8), db(-1))
    fx.add(t8, subdrop(1.8, 120, 34), db(-8))
    drums.add(t8, crash(3.0), db(-7))
    root, voicing = CHORDS[7]
    fr = [midi(n(x)) for x in voicing]
    final = supersaw(fr, 1.9, voices=9, detune=0.2)
    final = np.stack([sweep_filter(final[:, c], 6000, 1400, 'low', q=0.9) for c in range(2)], axis=-1)
    fenv = env_exp(1.9, 0.9, 0.004)[:, None]
    music.add(t8, final * fenv, db(-9))
    verb_send.add(t8, final * fenv, db(-9))
    bass.add(t8, sine(midi(n('A1')), 1.85) * env_exp(1.85, 0.6, 0.01), db(-9))
    fx.add(t8 + 0.02, whoosh(0.45, 800, 6000, -0.8, 0.6), db(-12))                 # the point travels
    for i, note in enumerate(['A5', 'C6', 'E6', 'G6', 'B6', 'E7']):                    # letters pop
        fx.add(t8 + 0.1 + i * 0.05, pluck(midi(n(note)), 0.4, 9000), db(-16), p=-0.6 + i * 0.24)
    logo = bell(midi(n('A5')), 2.0, index=2.2, ratio=2.0, decay=0.7) + 0.6 * bell(midi(n('E6')), 2.0, index=1.2, ratio=3.0, decay=0.5)
    fx.add(t8 + 0.44, logo, db(-8), p=0.25)                                            # lands
    verb_send.add(t8 + 0.44, pan(logo, 0.25), db(-8))
    for k in range(12):  # sub-line scramble chatter
        fx.add(t8 + BEAT + k * 0.028, tick(5000 + 300 * (k % 3), 0.01), db(-28), p=-0.4)
    echo = bell(midi(n('A6')), 1.3, index=1.0, ratio=2.0, decay=0.35)
    fx.add(t8 + 3 * BEAT, echo, db(-17), p=0.25)
    verb_send.add(t8 + 3 * BEAT, pan(echo, 0.25), db(-14))

    # ---------------- mix
    # sidechain: duck music + bass under each kick
    duck = np.ones(N)
    for k in kicks:
        i0 = int(k * SR)
        ln = int(0.28 * SR)
        m = min(ln, N - i0)
        curve = 1 - 0.75 * np.exp(-np.arange(m) / SR / 0.07)
        duck[i0:i0 + m] = np.minimum(duck[i0:i0 + m], curve)
    music.x *= duck[:, None]
    bass.x *= duck[:, None] ** 1.5

    wet = reverb(verb_send.x + music.x * 0.25 + fx.x * 0.18, seconds=2.4, predelay=0.025, damp=7000)
    mix = drums.x + bass.x + music.x * db(4) + fx.x * db(2) + wet * 0.5
    mix = hp(mix.T, 30).T
    # The breath: hard silence from the lone point (t7 + 1.64) to the last
    # downbeat, with short fades so nothing clicks.
    g0, g1 = int((t7 + 1.64) * SR), int((t8 - 0.004) * SR)
    gate = np.ones(N)
    fl = int(0.012 * SR)
    gate[g0:g1] = 0.0
    gate[g0 - fl:g0] = np.linspace(1, 0, fl)
    mix *= gate[:, None]
    breath = Bus()
    breath.add(t7 + 1.64, tick(5200, 0.02), db(-18))
    breath.add(t8 - 0.2, pan(reverse_crash(0.2), 0), db(-22))
    mix += breath.x
    # gentle glue: soft clip, then normalise to -1 dBFS
    mix *= db(3.0) / max(np.max(np.abs(mix)), 1e-9)
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix *= db(-1.0) / np.max(np.abs(mix))
    # tail: let the final reverb breathe, but finish cleanly at 15.000 s
    fade = int(0.12 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    return mix


def write_wav(path, x):
    from scipy.io import wavfile
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wavfile.write(path, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))


if __name__ == '__main__':
    out = os.path.join(ROOT, 'soundtrack.wav')
    write_wav(out, build())
    print(f'wrote {os.path.relpath(out)} ({DUR:.3f} s, {SR} Hz stereo)')
